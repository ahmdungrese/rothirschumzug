import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';

export async function GET() {
  return NextResponse.json({ success: true, message: "Seed endpoint is disabled." });
}
