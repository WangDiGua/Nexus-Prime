import { MilvusClient } from '@zilliz/milvus2-sdk-node';

async function testMilvus() {
  const client = new MilvusClient({
    address: '192.168.5.130:19530',
  });

  try {
    console.log('Testing Milvus connection...');
    
    const result = await client.hasCollection({ collection_name: 'message_vectors' });
    console.log('Milvus collection exists:', result);
    
    const collections = await client.showCollections();
    console.log('Milvus collections:', collections.data?.map((c: any) => c.name));
    
    console.log('✅ Milvus connection successful!');
  } catch (error) {
    console.error('❌ Milvus connection failed:', error);
  } finally {
    await client.closeConnection();
  }
}

testMilvus();
