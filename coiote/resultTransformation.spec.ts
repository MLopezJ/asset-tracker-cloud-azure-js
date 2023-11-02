import { describe, it } from 'node:test'
import assert from 'node:assert'
import { fromCoioteToAssetTrackerReported } from './resultTransformation.js'
import { coiote } from './deviceTwin.js'

void describe('example', () => {
	void it(`should transform from 'coiote' format to 'nRF Asset Tracker reported' format`, () => {
		const assetTrackerReported = fromCoioteToAssetTrackerReported(coiote)
		const expected = {
			bat: { v: 80, ts: 1675874731000 },
			dev: {
				v: {
					imei: '351358815340515',
					modV: '22.8.1+0',
					brdV: 'Nordic Semiconductor ASA',
				},
				ts: 1675874731000,
			},
			env: { v: { temp: 15, hum: 30, atmp: 10 }, ts: 1692369551000 },
			gnss: {
				v: { lng: 153.2176, lat: -43.5723, acc: 24.798573, alt: 2, spd: 5 },
				ts: 1665149633000,
			},
			cfg: {
				loct: 60,
				act: true,
				actwt: 120,
				mvres: 600,
				mvt: 7200,
				accath: 8.5,
				accith: 2.5,
				accito: 0.5,
				nod: ['gnss', 'ncell'],
			},
		}

		assert.deepEqual(assetTrackerReported, expected)
	})
})
