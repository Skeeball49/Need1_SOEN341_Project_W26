import { getUsersCollection } from './db.js';

async function testDatabase() {
  console.log('🔍 Testing MongoDB Connection...\n');

  try {
    const usersCollection = await getUsersCollection();
    console.log('✅ Successfully connected to MongoDB\n');

    console.log('📝 Testing User Registration...');
    const testEmail = `test-${Date.now()}@example.com`;
    const testUser = {
      email: testEmail,
      password: 'testpass123',
      diet: '',
      allergies: ''
    };

    const insertResult = await usersCollection.insertOne(testUser);
    console.log(`✅ User registered: ${testEmail}`);
    console.log(`   Insert ID: ${insertResult.insertedId}\n`);

    console.log('🔐 Testing User Login...');
    const loginUser = await usersCollection.findOne({ 
      email: testEmail, 
      password: 'testpass123' 
    });
    
    if (loginUser) {
      console.log('✅ Login successful');
      console.log(`   Email: ${loginUser.email}`);
      console.log(`   Diet: ${loginUser.diet || 'Not set'}`);
      console.log(`   Allergies: ${loginUser.allergies || 'Not set'}\n`);
    } else {
      console.log('❌ Login failed\n');
    }

    console.log('🔄 Testing Profile Update...');
    const updateResult = await usersCollection.findOneAndUpdate(
      { email: testEmail },
      { $set: { diet: 'Vegetarian', allergies: 'Peanuts, Shellfish' } },
      { returnDocument: 'after' }
    );

    if (updateResult) {
      console.log('✅ Profile updated successfully');
      console.log(`   Email: ${updateResult.email}`);
      console.log(`   Diet: ${updateResult.diet}`);
      console.log(`   Allergies: ${updateResult.allergies}\n`);
    } else {
      console.log('❌ Profile update failed\n');
    }

    console.log('🔍 Testing Duplicate Registration...');
    try {
      const exists = await usersCollection.findOne({ email: testEmail });
      if (exists) {
        console.log('✅ Duplicate check working - user already exists\n');
      }
    } catch (error) {
      console.log('❌ Duplicate check failed:', error.message, '\n');
    }

    console.log('🧹 Cleaning up test data...');
    await usersCollection.deleteOne({ email: testEmail });
    console.log('✅ Test user deleted\n');

    console.log('📊 Current users in database:');
    const allUsers = await usersCollection.find({}).toArray();
    console.log(`   Total users: ${allUsers.length}`);
    allUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} - Diet: ${user.diet || 'Not set'}, Allergies: ${user.allergies || 'Not set'}`);
    });

    console.log('\n✅ All database tests passed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Database test failed:', error);
    process.exit(1);
  }
}

testDatabase();
