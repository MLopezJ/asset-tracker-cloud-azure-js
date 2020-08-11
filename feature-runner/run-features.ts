import {
	FeatureRunner,
	ConsoleReporter,
	randomStepRunners,
	restStepRunners,
} from '@bifravst/e2e-bdd-test-runner'
import * as program from 'commander'
import * as chalk from 'chalk'
import { randomEmail } from './lib/randomEmail'
import { randomPassword } from './lib/randomPassword'
import { b2cSteps } from './steps/b2c'
import { fromEnv } from '../lib/fromEnv'

let ran = false

type BifravstWorld = { apiEndpoint: string }

program
	.arguments('<featureDir>')
	.option('-r, --print-results', 'Print results')
	.option('-p, --progress', 'Print progress')
	.option('-X, --no-retry', 'Do not retry steps')
	.action(
		async (
			featureDir: string,
			{
				printResults,
				progress,
				retry,
			}: {
				printResults: boolean
				subscription: string
				progress: boolean
				retry: boolean
			},
		) => {
			ran = true

			const {
				b2cTenant,
				clientId,
				clientSecret,
				tenantId,
				resourceGroup,
				apiEndpoint,
			} = fromEnv({
				b2cTenant: 'B2C_TENANT',
				clientId: 'APP_REG_CLIENT_ID',
				clientSecret: 'B2C_CLIENT_SECRET',
				tenantId: 'B2C_TENANT_ID',
				resourceGroup: 'RESOURCE_GROUP_NAME',
				apiEndpoint: 'API_ENDPOINT',
			})(process.env)

			console.log(
				chalk.yellow('Resource Group:         '),
				chalk.blueBright(resourceGroup),
			)
			console.log(
				chalk.yellow('API endpoint:           '),
				chalk.blueBright(apiEndpoint),
			)
			console.log(
				chalk.yellow('AD B2C Tenant:          '),
				chalk.blueBright(b2cTenant),
			)
			console.log(
				chalk.yellow('AD B2C Tenant ID:       '),
				chalk.blueBright(tenantId),
			)
			console.log(
				chalk.yellow('AD B2C Client ID:       '),
				chalk.blueBright(clientId),
			)
			console.log(
				chalk.yellow('AD B2C Client Secret:   '),
				chalk.blueBright(
					`${clientSecret.substr(0, 5)}***${clientSecret.substr(-5)}`,
				),
			)
			console.log()

			const world: BifravstWorld = {
				apiEndpoint: `${apiEndpoint}api/`,
			} as const
			console.log(chalk.yellow.bold('World:'))
			console.log()
			console.log(world)
			console.log()
			if (!retry) {
				console.log()
				console.log(chalk.yellow.bold('Test Runner:'))
				console.log()
				console.log('', chalk.red('❌'), chalk.red('Retries disabled.'))
				console.log()
			}

			const runner = new FeatureRunner<BifravstWorld>(world, {
				dir: featureDir,
				reporters: [
					new ConsoleReporter({
						printResults,
						printProgress: progress,
						printProgressTimestamps: true,
						printSummary: true,
					}),
				],
				retry,
			})
			runner
				.addStepRunners(
					randomStepRunners({
						generators: {
							email: randomEmail,
							password: randomPassword,
						},
					}),
				)
				.addStepRunners(
					await b2cSteps({
						b2cTenant,
						clientId,
						clientSecret,
						tenantId,
					}),
				)
				.addStepRunners(restStepRunners())

			try {
				const { success } = await runner.run()
				if (!success) {
					process.exit(1)
				}
				process.exit()
			} catch (error) {
				console.error(chalk.red('Running the features failed!'))
				console.error(error)
				process.exit(1)
			}
		},
	)
	.parse(process.argv)

if (!ran) {
	program.outputHelp(chalk.red)
	process.exit(1)
}
