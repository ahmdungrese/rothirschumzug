import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// Hilfsfunktion: Überprüft das Auth-Token und die Berechtigung (Admin oder Büro)
async function verifyEmailSender(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const idToken = authHeader.split('Bearer ')[1];
  const decodedToken = await adminAuth.verifyIdToken(idToken);

  const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
  const userData = userDoc.data();

  // Nur bestehende Mitarbeiter (Admin oder Büro) dürfen Mails versenden
  if (!userData || !['admin', 'office'].includes(userData.role)) {
    throw new Error('Forbidden');
  }

  return decodedToken.uid;
}

export async function POST(req: NextRequest) {
  try {
    await verifyEmailSender(req);
    const formData = await req.formData();
    
    // Extrahieren der SMTP Einstellungen
    const smtpHost = formData.get('smtpHost') as string;
    const smtpPort = formData.get('smtpPort') as string;
    const smtpUser = formData.get('smtpUser') as string;
    const smtpPass = formData.get('smtpPass') as string;
    const fromName = formData.get('fromName') as string || 'Rothirsch Umzüge';
    
    // Extrahieren der E-Mail Inhalte
    const to = formData.get('to') as string;
    const subject = formData.get('subject') as string;
    const text = formData.get('text') as string;
    const fileName = formData.get('fileName') as string;
    const file = formData.get('file') as Blob;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json({ success: false, error: 'SMTP-Daten fehlen in den Einstellungen.' }, { status: 400 });
    }

    if (!to || !subject) {
      return NextResponse.json({ success: false, error: 'Empfänger oder Betreff fehlen.' }, { status: 400 });
    }

    const attachments = [];
    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      attachments.push({
        filename: fileName || 'Dokument.pdf',
        content: buffer,
        contentType: 'application/pdf',
      });
    }

    // Transporter konfigurieren
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort || '465'),
      secure: parseInt(smtpPort || '465') === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // E-Mail senden
    const info = await transporter.sendMail({
      from: `"${fromName}" <${smtpUser}>`, // Absender-Name und Mail
      to: to,
      subject: subject,
      text: text,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    console.log('Message sent: %s', info.messageId);

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Nicht autorisiert. Bitte anmelden.' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Keine Berechtigung zum E-Mail-Versand.' }, { status: 403 });
    }
    console.error('Fehler beim E-Mail Versand:', error);
    return NextResponse.json({ success: false, error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}
