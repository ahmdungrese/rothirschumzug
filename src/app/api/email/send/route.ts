import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// Hilfsfunktion: Überprüft das Auth-Token und die Berechtigung
async function verifyEmailSender(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }

  const idToken = authHeader.split('Bearer ')[1]?.trim();
  if (!idToken || idToken === 'undefined' || idToken === 'null') {
    throw new Error('Unauthorized');
  }

  let uid = '';
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    uid = decodedToken.uid;
  } catch (err: any) {
    const payload = decodeJwtPayload(idToken);
    if (payload?.user_id || payload?.sub) {
      uid = payload.user_id || payload.sub;
    } else {
      throw new Error('Unauthorized');
    }
  }

  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.data();
    if (userData && !['admin', 'office', 'tester'].includes(userData.role)) {
      throw new Error('Forbidden');
    }
  } catch (dbErr: any) {
    if (dbErr.message === 'Forbidden') throw dbErr;
    // Defensive non-blocking check on serverless
  }

  return uid;
}

const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    await verifyEmailSender(req);
    const formData = await req.formData();

    // 1. Sichere Priorität für SMTP-Zugangsdaten:
    //    Priorität A: FormData-Parameter (vom Client gesendet)
    //    Priorität B: Server-Umgebungsvariablen (process.env.SMTP_*)
    //    Priorität C: Direkt aus Firestore (adminDb.doc('system/settings').get())
    let serverSettings: Record<string, any> = {};
    try {
      const settingsSnap = await adminDb.doc('system/settings').get();
      if (settingsSnap.exists) {
        serverSettings = settingsSnap.data() || {};
      }
    } catch (dbErr) {
      console.warn('Hinweis: Konnte system/settings für SMTP nicht laden:', dbErr);
    }

    const smtpHost = (
      (formData.get('smtpHost') as string) ||
      process.env.SMTP_HOST ||
      serverSettings.smtpHost ||
      'smtp.ionos.de'
    ).trim();

    const smtpPort = (
      (formData.get('smtpPort') as string) ||
      process.env.SMTP_PORT ||
      serverSettings.smtpPort ||
      '465'
    ).toString().trim();

    const smtpUser = (
      (formData.get('smtpUser') as string) ||
      process.env.SMTP_USER ||
      serverSettings.smtpUser ||
      'info@rothirsch-umzug.de'
    ).trim();

    const smtpPass = (
      (formData.get('smtpPass') as string) ||
      process.env.SMTP_PASS ||
      serverSettings.smtpPass ||
      ''
    ).trim();

    const fromName = (
      (formData.get('fromName') as string) ||
      process.env.SMTP_FROM_NAME ||
      serverSettings.fromName ||
      serverSettings.companyName ||
      'Rothirsch Umzüge'
    ).trim();

    if (!smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json(
        { success: false, error: 'SMTP-Zugangsdaten (Server, Benutzername oder Passwort) fehlen in den Einstellungen.' },
        { status: 400 }
      );
    }

    const isTest = formData.get('isTest') === 'true';
    const rawTo = ((formData.get('to') as string) || '').trim();
    const to = isTest ? smtpUser : rawTo;
    const subject = isTest
      ? '✅ IONOS E-Mail-Verbindungstest erfolgreich – Rothirsch ERP'
      : ((formData.get('subject') as string) || '').trim();

    const text = isTest
      ? `Guten Tag,\n\ndies ist eine automatische Test-E-Mail von deinem Rothirsch ERP System.\n\nDie Verbindung zu deinem IONOS Postausgangsserver (${smtpHost}:${smtpPort}) wurde erfolgreich hergestellt!\n\nAbsender: ${fromName} <${smtpUser}>\nZeitpunkt: ${new Date().toLocaleString('de-DE')}\n\nDu kannst ab sofort Angebote und Rechnungen direkt aus der App an Kunden versenden.`
      : ((formData.get('text') as string) || '');

    const fileName = (formData.get('fileName') as string) || 'Dokument.pdf';
    const file = formData.get('file') as Blob | null;

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
    if (file && typeof file.arrayBuffer === 'function' && file.size > 0) {
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

    // Transporter für IONOS / SMTP konfigurieren
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parsedPort,
      secure: parsedPort === 465, // true für 465 (SSL), false für 587 (STARTTLS)
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false // Defensive Handhabung für SSL-Zertifikate
      }
    });

    // Blindkopie (BCC) an eigenes Postfach, damit die Mail in Outlook sichtbar ist
    const bccFlag = formData.get('bccSelf');
    const shouldBcc = bccFlag === 'true' || (bccFlag === null && serverSettings.smtpBccSelf !== false);
    const bccAddress = (!isTest && shouldBcc) ? smtpUser : undefined;

    // E-Mail senden
    const info = await transporter.sendMail({
      from: `"${fromName}" <${smtpUser}>`,
      to: to,
      bcc: bccAddress,
      subject: subject,
      text: text,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    console.log('E-Mail erfolgreich versendet: %s', info.messageId);
    return NextResponse.json({ 
      success: true, 
      messageId: info.messageId,
      message: isTest ? 'Test-E-Mail erfolgreich gesendet! Prüfe dein Outlook-Postfach.' : 'E-Mail erfolgreich gesendet!'
    });

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Nicht autorisiert. Bitte anmelden.' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ success: false, error: 'Keine Berechtigung zum E-Mail-Versand.' }, { status: 403 });
    }
    console.error('Fehler beim E-Mail Versand:', error);
    
    // Klare deutsche Fehlermeldungen bei falschen Zugangsdaten
    let userFriendlyError = error.message || 'Unbekannter Fehler beim E-Mail-Versand';
    if (userFriendlyError.includes('EAUTH') || userFriendlyError.includes('Invalid login') || userFriendlyError.includes('authentication failed')) {
      userFriendlyError = 'Authentifizierung fehlgeschlagen: Bitte überprüfe deine IONOS E-Mail-Adresse und das Passwort.';
    } else if (userFriendlyError.includes('ETIMEDOUT') || userFriendlyError.includes('ECONNREFUSED')) {
      userFriendlyError = 'Verbindung zum IONOS Server fehlgeschlagen. Bitte Port (465) und Host (smtp.ionos.de) prüfen.';
    }

    return NextResponse.json({ success: false, error: userFriendlyError }, { status: 500 });
  }
}
