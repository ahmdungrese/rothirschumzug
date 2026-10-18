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

const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    await verifyEmailSender(req);
    const formData = await req.formData();

    // 1. Sichere Priorität für SMTP-Zugangsdaten:
    //    Priorität A: Server-Umgebungsvariablen (process.env.SMTP_*)
    //    Priorität B: Direkt aus Firestore auf dem Server (adminDb.doc('system/settings').get())
    //    Priorität C: Fallback auf FormData-Parameter
    let serverSettings: Record<string, any> = {};
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      try {
        const settingsSnap = await adminDb.doc('system/settings').get();
        if (settingsSnap.exists) {
          serverSettings = settingsSnap.data() || {};
        }
      } catch (dbErr) {
        console.warn('Hinweis: Konnte system/settings für SMTP nicht laden:', dbErr);
      }
    }

    const smtpHost = (
      process.env.SMTP_HOST ||
      serverSettings.smtpHost ||
      (formData.get('smtpHost') as string) ||
      ''
    ).trim();
    const smtpPort = (
      process.env.SMTP_PORT ||
      serverSettings.smtpPort ||
      (formData.get('smtpPort') as string) ||
      '465'
    ).toString().trim();
    const smtpUser = (
      process.env.SMTP_USER ||
      serverSettings.smtpUser ||
      (formData.get('smtpUser') as string) ||
      ''
    ).trim();
    const smtpPass =
      process.env.SMTP_PASS ||
      serverSettings.smtpPass ||
      (formData.get('smtpPass') as string) ||
      '';
    const fromName = (
      process.env.SMTP_FROM_NAME ||
      (formData.get('fromName') as string) ||
      serverSettings.companyName ||
      'Rothirsch Umzüge'
    ).trim();

    // Extrahieren der E-Mail Inhalte
    const to = ((formData.get('to') as string) || '').trim();
    const subject = ((formData.get('subject') as string) || '').trim();
    const text = (formData.get('text') as string) || '';
    const fileName = (formData.get('fileName') as string) || 'Dokument.pdf';
    const file = formData.get('file') as Blob | null;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json(
        { success: false, error: 'SMTP-Daten fehlen in den Server-Umgebungsvariablen oder Einstellungen.' },
        { status: 400 }
      );
    }

    if (!to || !subject) {
      return NextResponse.json(
        { success: false, error: 'Empfänger oder Betreff fehlen.' },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(to)) {
      return NextResponse.json(
        { success: false, error: 'Ungültige Empfänger-E-Mail-Adresse.' },
        { status: 400 }
      );
    }

    const attachments = [];
    if (file && typeof file.arrayBuffer === 'function') {
      if (typeof file.size === 'number' && file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        return NextResponse.json(
          { success: false, error: 'Anhang überschreitet die maximale Größe von 15 MB.' },
          { status: 413 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.byteLength > MAX_ATTACHMENT_SIZE_BYTES) {
        return NextResponse.json(
          { success: false, error: 'Anhang überschreitet die maximale Größe von 15 MB.' },
          { status: 413 }
        );
      }

      attachments.push({
        filename: fileName || 'Dokument.pdf',
        content: buffer,
        contentType: 'application/pdf',
      });
    }

    const parsedPort = parseInt(smtpPort || '465', 10) || 465;

    // Transporter konfigurieren
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parsedPort,
      secure: parsedPort === 465, // true for 465, false for other ports
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
    return NextResponse.json({ success: true, messageId: info.messageId });

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
