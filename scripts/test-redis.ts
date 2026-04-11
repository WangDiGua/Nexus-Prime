import { Redis } from 'ioredis';

async function testRedis() {
  const redis = new Redis({
    host: '192.168.5.130',
    port: 6379,
    password: 'redispassword',
    db: 0,
  });

  try {
    const result = await redis.ping();
    console.log('Redis PING:', result);
    
    await redis.set('test_key', 'hello_nexus');
    const value = await redis.get('test_key');
    console.log('Redis SET/GET:', value);
    
    await redis.del('test_key');
    console.log('Redis DEL: success');
    
    console.log('✅ Redis connection successful!');
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
  } finally {
    await redis.quit();
  }
}

testRedis();
