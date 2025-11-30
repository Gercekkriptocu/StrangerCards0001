import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = '2F5B5834-F8C6-4519-B531-EC7DA830BFEB';

  try {
    // Generate 50 random FIDs (Farcaster IDs) between 1 and 500000
    // This ensures we get real, active Farcaster users
    const randomFids: number[] = [];
    for (let i = 0; i < 50; i++) {
      const randomFid = Math.floor(Math.random() * 500000) + 1;
      randomFids.push(randomFid);
    }

    console.log('🎲 Generated random FIDs:', randomFids.slice(0, 10), '...');

    // Fetch users by FIDs using bulk endpoint
    const fidsString = randomFids.join(',');
    const response = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fidsString}`, {
      headers: {
        accept: 'application/json',
        api_key: apiKey,
      },
      cache: 'no-store' // Fresh data every time
    });

    console.log('📊 Neynar API Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Neynar API Error Response:', errorText);
      throw new Error(`Neynar API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const users = data.users;

    console.log('📦 Neynar API returned users count:', users?.length || 0);

    if (!users || users.length === 0) {
      console.error('❌ No users returned from Neynar API');
      throw new Error('No users returned from API');
    }

    // Filter out users without username (inactive or deleted accounts)
    const activeUsers = users.filter((u: any) => u.username && u.username.length > 0);
    console.log('✅ Active users with username:', activeUsers.length);

    if (activeUsers.length === 0) {
      throw new Error('No active users found');
    }

    // Fisher-Yates shuffle for proper randomization
    const shuffled = [...activeUsers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Select first 3 and extract only usernames
    const selectedUsernames = shuffled.slice(0, 3).map((u: any) => u.username);

    console.log('🎯 Selected random users:', selectedUsernames);

    return NextResponse.json({ usernames: selectedUsernames });
  } catch (error) {
    console.error('❌ Neynar Fetch Error:', error);
    // Fallback to popular Base/Farcaster accounts
    return NextResponse.json({ 
      usernames: ['dwr', 'jessepollak', 'base'] 
    });
  }
}
