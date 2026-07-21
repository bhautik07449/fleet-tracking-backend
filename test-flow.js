async function runTest() {
  const baseUrl = 'http://127.0.0.1:3000/api/v1';
  let token = '';

  const request = async (path, method = 'GET', body = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    
    const res = await fetch(baseUrl + path, options);
    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data, null, 2));
    return data;
  };

  try {
    console.log('1. Registering new company & owner...');
    const regRes = await request('/auth/register', 'POST', {
      companyName: 'Test Corp ' + Date.now(),
      name: 'Test Admin',
      email: 'admin' + Date.now() + '@test.com',
      password: 'password123'
    });
    console.log(regRes);
    token = regRes.data.token;
    console.log('✅ Registered! Token:', token.substring(0, 10) + '...');

    console.log('2. Adding GPS Device...');
    const imei = '999999999999999';
    await request('/gps-devices', 'POST', {
      imei,
      deviceModel: 'TestTracker',
      simNumber: '+1234567890'
    });
    console.log('✅ GPS Device added!');
    
    console.log('3. Adding Driver...');
    await request('/drivers', 'POST', {
      name: 'John Test',
      licenseNumber: 'LIC' + Date.now(),
      contactInfo: '+1987654321'
    });
    console.log('✅ Driver added!');

    console.log('4. Fetching Drivers and Devices to get IDs...');
    const getDrivers = await request('/drivers');
    const getDevices = await request('/gps-devices');
    const dId = getDrivers.data.drivers[0].id;
    const gId = getDevices.data.devices[0].id;

    console.log('5. Adding Vehicle...');
    await request('/vehicles', 'POST', {
      vehicleNumber: 'TEST-1234',
      model: 'Ford Transit',
      driverId: dId,
      gpsDeviceId: gId
    });
    console.log('✅ Vehicle added!');
    
    console.log('6. Adding Geofence...');
    await request('/geofences', 'POST', {
      name: 'Test Zone',
      type: 'CIRCLE',
      coordinates: [{ lat: 40, lng: -74 }],
      radius: 500
    });
    console.log('✅ Geofence added!');

    console.log('🎉 ALL CRUD OPERATIONS SUCCESSFUL!');
  } catch (err) {
    console.error('❌ ERROR:', err.message);
  }
}

runTest();
