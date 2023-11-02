import {
	converter as assetTrackerReportedConverter,
	type nRFAssetTrackerReportedType,
} from '@nordicsemiconductor/asset-tracker-lwm2m'
import {
	converter as lwm2mConverter,
	type DeviceTwin,
} from '@nordicsemiconductor/coiote-azure-converter'

/**
 * Result Transformation example of usage
 */
export const fromCoioteToAssetTrackerReported = (
	coiote: DeviceTwin,
): nRFAssetTrackerReportedType => {
	const lwm2m = lwm2mConverter(coiote)
	const nRFAssetTrackerReported = assetTrackerReportedConverter(lwm2m)
	return nRFAssetTrackerReported
}
