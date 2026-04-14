async function testQdrant() {
  const baseUrl = (process.env.QDRANT_URL || 'http://8.137.15.201:6333').replace(
    /\/+$/,
    '',
  );
  const apiKey = process.env.QDRANT_API_KEY || process.env.QDRANT_TOKEN || '';

  try {
    console.log('Testing Qdrant connection...');

    const response = await fetch(`${baseUrl}/collections`, {
      headers: apiKey ? { 'api-key': apiKey } : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const json = (await response.json()) as {
      result?: {
        collections?: Array<{ name?: string }>;
      };
    };

    console.log(
      'Qdrant collections:',
      (json.result?.collections || []).map((item) => item.name),
    );

    console.log('Qdrant connection successful!');
  } catch (error) {
    console.error('Qdrant connection failed:', error);
    process.exitCode = 1;
  }
}

void testQdrant();
