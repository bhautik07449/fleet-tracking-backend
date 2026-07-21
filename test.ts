import pool from './src/db/index';
import { processLocationUpdate } from './src/services/location.service';

async function test() {
  try {
    await processLocationUpdate({
      imei: '123456789012345',
      latitude: 40.713012,
      longitude: -74.005952,
      speed: 75,
      heading: 61,
      altitude: 10,
      ignitionStatus: true,
      timestamp: new Date()
    });
    console.log('SUCCESS');
  } catch (err: any) {
    console.error('ERROR_CAUGHT:', err.message);
  } finally {
    process.exit(0);
  }
}
test();
