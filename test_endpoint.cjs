const fs = require('fs');

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/vision/identify-species', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAAAAAAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
        maxResults: 3,
        confidenceThreshold: 0.5
      })
    });
    
    const status = res.status;
    const body = await res.text();
    console.log(`Status: ${status}`);
    console.log(`Body: ${body}`);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

test();
