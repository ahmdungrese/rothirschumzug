import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  try {
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

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error('Fehler beim E-Mail Versand:', error);
    return NextResponse.json({ success: false, error: error.message || 'Unbekannter Fehler' }, { status: 500 });
  }
}
