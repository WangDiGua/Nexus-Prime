const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedDatabase() {
  console.log('🌱 开始初始化数据库...');

  const existingUser = await prisma.user.findUnique({
    where: { username: 'admin' },
  });

  if (existingUser) {
    console.log('✅ 管理员账号已存在');
    console.log('   用户名: admin');
    console.log('   密码: admin123');
    await prisma.$disconnect();
    return;
  }

  const hashedPassword = await bcrypt.hash('admin123', 12);

  const user = await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash: hashedPassword,
      email: 'admin@nexus.local',
      displayName: '管理员',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  console.log('✅ 管理员账号创建成功！');
  console.log('   用户名: admin');
  console.log('   密码: admin123');
  console.log('   用户ID:', user.id);

  await prisma.userSettings.create({
    data: {
      userId: user.id,
      defaultModel: 'qwen-plus-latest',
      theme: 'SYSTEM',
      language: 'zh-CN',
      maxTokens: 4096,
      temperature: 0.7,
      enableHistoryContext: true,
      historyContextLimit: 10,
      enableVectorSearch: true,
    },
  });

  console.log('✅ 用户设置初始化完成');
  console.log('\n🎉 数据库初始化完成！现在可以使用以下账号登录：');
  console.log('   用户名: admin');
  console.log('   密码: admin123');

  await prisma.$disconnect();
}

seedDatabase().catch((error) => {
  console.error('❌ 初始化失败:', error);
  process.exit(1);
});
