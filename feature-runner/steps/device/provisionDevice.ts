import { DeviceRegistrationState } from 'azure-iot-provisioning-service/dist/interfaces'
import { promises as fs } from 'fs'
import { connect } from 'mqtt'
import {
	DeviceCertificateJSON,
	deviceFileLocations,
} from '../../../cli/iot/certificates/deviceFileLocations.js'
import { globalIotHubDPSHostname } from '../../../cli/iot/ioTHubDPSInfo.js'
import { dpsTopics } from './dpsTopics.js'

/**
 * Connect the device to the Azure IoT Hub.
 * If this device is not yet registered, connect to the Device Provisioning Service (DPS) to acquire the assigned IoT Hub hostname.
 */
export const provisionDevice = async ({
	deviceId,
	certsDir,
	log,
}: {
	deviceId: string
	log?: (...args: any[]) => void
	certsDir: string
}): Promise<{ assignedHub: string; isNew: boolean }> => {
	const deviceFiles = deviceFileLocations({
		certsDir,
		deviceId,
	})

	const { privateKey, clientCert, caCert, idScope } = JSON.parse(
		await fs.readFile(deviceFiles.json, 'utf-8'),
	) as DeviceCertificateJSON

	try {
		log?.(`Loading config from`, deviceFiles.registration)
		const res = await fs.readFile(deviceFiles.registration, 'utf-8')
		return { assignedHub: JSON.parse(res).assignedHub, isNew: false }
	} catch {
		log?.(`Connecting to`, globalIotHubDPSHostname)
		log?.(`ID scope`, idScope)
		// Connect to Device Provisioning Service using MQTT
		// @see https://docs.microsoft.com/en-us/azure/iot-dps/iot-dps-mqtt-support

		const client = connect({
			host: globalIotHubDPSHostname,
			port: 8883,
			key: privateKey,
			cert: clientCert,
			ca: caCert,
			rejectUnauthorized: true,
			clientId: deviceId,
			username: `${idScope}/registrations/${deviceId}/api-version=2019-03-31`,
			protocol: 'mqtts',
			protocolVersion: 4,
			clean: true,
		})
		client.on('error', (err) => {
			console.error(`Error while provisioning device: ${err.message}`)
			throw err
		})
		// To register a device through DPS, a device should subscribe using $dps/registrations/res/# as a Topic Filter. The multi-level wildcard # in the Topic Filter is used only to allow the device to receive additional properties in the topic name. DPS does not allow the usage of the # or ? wildcards for filtering of subtopics. Since DPS is not a general-purpose pub-sub messaging broker, it only supports the documented topic names and topic filters.
		client.subscribe(dpsTopics.registrationResponses)

		client.on('connect', () => {
			log?.('Connected', deviceId)

			// The device should publish a register message to DPS using $dps/registrations/PUT/iotdps-register/?$rid={request_id} as a Topic Name. The payload should contain the Device Registration object in JSON format. In a successful scenario, the device will receive a response on the $dps/registrations/res/202/?$rid={request_id}&retry-after=x topic name where x is the retry-after value in seconds. The payload of the response will contain the RegistrationOperationStatus object in JSON format.
			client.publish(
				dpsTopics.register(),
				JSON.stringify({
					registrationId: deviceId,
				}),
			)
		})

		// The device must poll the service periodically to receive the result of the device registration operation.
		const registration = await new Promise<DeviceRegistrationState>(
			(resolve, reject) => {
				client.on('message', (topic, payload) => {
					const message = JSON.parse(payload.toString())
					if (topic.startsWith(dpsTopics.registrationResult(202))) {
						const args = new URLSearchParams(topic.split('?').pop())
						const { operationId, status } = message
						log?.('Status', status)
						log?.('Retry after', args.get('retry-after' as string))
						setTimeout(
							() => {
								// Assuming that the device has already subscribed to the $dps/registrations/res/# topic as indicated above, it can publish a get operationstatus message to the $dps/registrations/GET/iotdps-get-operationstatus/?$rid={request_id}&operationId={operationId} topic name. The operation ID in this message should be the value received in the RegistrationOperationStatus response message in the previous step.
								client.publish(dpsTopics.registationStatus(operationId), '')
							},
							parseInt(args.get('retry-after') ?? '1', 10) * 1000,
						)
						return
					}
					// In the successful case, the service will respond on the $dps/registrations/res/200/?$rid={request_id} topic. The payload of the response will contain the RegistrationOperationStatus object. The device should keep polling the service if the response code is 202 after a delay equal to the retry-after period. The device registration operation is successful if the service returns a 200 status code.
					if (topic.startsWith(dpsTopics.registrationResult(200))) {
						const { status, registrationState } = message
						log?.('Status', status)
						log?.('IoT Hub', registrationState.assignedHub)
						resolve(registrationState)
					}
					// Invalid certificates
					if (topic.startsWith(dpsTopics.registrationResult(401))) {
						reject(new Error(`Connection forbidden: ${message.message}`))
					}
					reject(new Error(`Unexpected message on topic ${topic}!`))
				})
				client.on('error', (err) => {
					console.error(
						`Error while polling for provisioning status: ${err.message}`,
					)
					throw err
				})
			},
		)

		client.end()
		log?.(`Device registration succeeded with IotHub`, registration.assignedHub)
		await fs.writeFile(
			deviceFiles.registration,
			JSON.stringify(registration, null, 2),
			'utf-8',
		)
		return { assignedHub: registration.assignedHub, isNew: true }
	}
}
