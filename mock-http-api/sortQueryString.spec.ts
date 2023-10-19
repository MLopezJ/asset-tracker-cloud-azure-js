import { sortQueryString } from './sortQueryString.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'
void describe('sortQueryString', () => {
	void it('should sort the query part of a mock URL', () =>
		assert.equal(
			sortQueryString(
				'api.nrfcloud.com/v1/location/agps?eci=73393515&tac=132&requestType=custom&mcc=397&mnc=73&customTypes=2',
			),
			'api.nrfcloud.com/v1/location/agps?customTypes=2&eci=73393515&mcc=397&mnc=73&requestType=custom&tac=132',
		))
})
