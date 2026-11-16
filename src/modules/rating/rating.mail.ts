import { sendEmail, getGenderTitle, getGreeting } from "../../shared/mail/mail.service";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import * as repo from "./rating.repository";

// Template HTML & pengiriman email rating (reminder, konfirmasi approver, ringkasan submitter).

// Enum for tracking purposes
export enum RatingReminderStage {
  INITIAL = 'initial',     // Right after marking as finished
  DAY_THREE = 'day_three', // 3 days after
  DAY_SEVEN = 'day_seven', // 7 days after
  FINAL = 'final'          // 10 days - final reminder
}

/**
 * Send an email to remind an approver to submit their rating
 */
export async function sendRatingReminderEmail(
  approvalId: number,
  recipientEmail: string,
  recipientName: string,
  recipientGender: string,
  handoverId: number,
  projectName: string, 
  docNumber: string,
  reminderStage: RatingReminderStage
): Promise<boolean> {
  try {
    // Set email subject and urgency level based on reminder stage
    let emailSubject = `[Go-Document] Pengingat: Mohon Berikan Penilaian untuk Handover ${projectName}`;
    let urgencyLevel = "normal";
    let deadlineText = "";
    
    switch (reminderStage) {
      case RatingReminderStage.DAY_THREE:
        urgencyLevel = "medium";
        deadlineText = "Anda memiliki 7 hari lagi untuk memberikan penilaian.";
        break;
      case RatingReminderStage.DAY_SEVEN:
        emailSubject = `[Go-Document] PENTING: Penilaian Handover ${projectName} Belum Diberikan`;
        urgencyLevel = "high";
        deadlineText = "Anda memiliki 3 hari lagi untuk memberikan penilaian.";
        break;
      case RatingReminderStage.FINAL:
        emailSubject = `[Go-Document] MENDESAK: Batas Waktu Penilaian Handover ${projectName} Akan Berakhir`;
        urgencyLevel = "critical";
        deadlineText = "Ini adalah kesempatan terakhir Anda untuk memberikan penilaian. Sistem akan ditutup dalam 10 jam.";
        break;
      default:
        deadlineText = "Mohon berikan penilaian dalam 10 hari.";
    }

    // Create email content based on template
    const emailContent = createRatingReminderTemplate(
      recipientName,
      recipientGender,
      projectName,
      docNumber,
      urgencyLevel,
      deadlineText,
      handoverId
    );

    // Send email
    await sendEmail({
      to: recipientEmail,
      subject: emailSubject,
      html: emailContent
    });

    console.log(`✅ Rating reminder email (${reminderStage}) sent to: ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ Error sending rating reminder email to ${recipientEmail}:`, error);
    return false;
  }
}

/**
 * Create email template for rating reminders
 */
function createRatingReminderTemplate(
  recipientName: string,
  recipientGender: string,
  projectName: string,
  docNumber: string,
  urgencyLevel: string,
  deadlineText: string,
  handoverId: number
): string {
  const greeting = getGreeting();
  const currentDate = format(new Date(), "dd MMMM yyyy, HH:mm:ss", { locale: id });
  
  // CSS class for urgency levels
  let urgencyClass = "urgency-normal";
  let urgencyColor = "#17a2b8";
  let urgencyTitle = "Pengingat";
  
  if (urgencyLevel === "medium") {
    urgencyClass = "urgency-medium";
    urgencyColor = "#ffc107";
    urgencyTitle = "Penting";
  } else if (urgencyLevel === "high") {
    urgencyClass = "urgency-high";
    urgencyColor = "#fd7e14";
    urgencyTitle = "Sangat Penting";
  } else if (urgencyLevel === "critical") {
    urgencyClass = "urgency-critical";
    urgencyColor = "#dc3545";
    urgencyTitle = "Mendesak!";
  }
  
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Go-Document System - Pengingat Penilaian</title>
    <style>
      body { 
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
        line-height: 1.6; 
        color: #333; 
        margin: 0; 
        padding: 0;
        background-color: #f9f9f9;
      }
      .container { 
        max-width: 650px; 
        margin: 0 auto; 
        padding: 20px;
        background-color: #ffffff;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      .header { 
        text-align: center; 
        margin-bottom: 30px; 
        padding-bottom: 20px;
        border-bottom: 1px solid #eee;
      }
      .header h1 {
        color: #2c3e50;
        margin: 0;
        font-size: 28px;
      }
      .content { 
        margin-bottom: 30px; 
        padding: 0 10px;
      }
      .content p {
        margin-bottom: 15px;
        color: #555;
      }
      .document-title {
        background-color: #f8f9fa;
        padding: 15px;
        border-radius: 5px;
        margin: 20px 0;
        border-left: 4px solid #007bff;
        font-weight: bold;
        font-size: 16px;
      }
      .urgency-box {
        background-color: #f8f9fa;
        border-left: 4px solid ${urgencyColor};
        padding: 15px;
        margin: 25px 0;
        border-radius: 5px;
      }
      .urgency-title {
        margin-top: 0;
        color: ${urgencyColor};
        font-weight: 700;
        font-size: 18px;
      }
      .urgency-message {
        margin-bottom: 0;
        color: #555;
        font-weight: 500;
      }
      .button-container {
        text-align: center;
        margin: 30px 0;
      }
      .button {
        display: inline-block;
        background-color: #007bff;
        color: white;
        padding: 12px 25px;
        text-decoration: none;
        border-radius: 5px;
        font-weight: bold;
        text-align: center;
        transition: background-color 0.3s;
      }
      .button:hover {
        background-color: #0069d9;
      }
      .rating-box {
        background-color: #fff8e1;
        border: 1px solid #ffecb3;
        border-radius: 8px;
        padding: 20px;
        margin: 25px 0;
        text-align: center;
      }
      .star-icon {
        color: #ffc107;
        font-size: 24px;
        margin: 0 5px;
      }
      .rating-text {
        font-weight: 600;
        color: #856404;
        margin-top: 10px;
      }
      .footer { 
        margin-top: 40px; 
        padding-top: 20px;
        border-top: 1px solid #eee;
        text-align: center;
        font-size: 14px;
        color: #6c757d;
      }
      .footer p {
        margin: 5px 0;
      }
      .signature {
        margin-top: 15px;
        font-weight: 600;
        color: #495057;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Go-Document System</h1>
      </div>
      
      <div class="content">
        <p>${greeting}</p>
        <p>Yth. ${recipientGender} ${recipientName},</p>
        
        <div class="urgency-box ${urgencyClass}">
          <h3 class="urgency-title">${urgencyTitle}</h3>
          <p class="urgency-message">Anda belum memberikan penilaian untuk dokumen handover yang telah selesai. ${deadlineText}</p>
        </div>
        
        <p>Dengan hormat,</p>
        <p>Kami mengingatkan bahwa dokumen handover untuk <strong>${projectName}</strong> - (<strong>${docNumber}</strong>) telah selesai diproses dan menunggu penilaian dari Anda sebagai approver.</p>
        
        <div class="document-title">
          ${projectName} - ${docNumber}
        </div>
        
        <div class="rating-box">
          <p>Berikan penilaian Anda dengan skala 1-5:</p>
          <div>
            <span class="star-icon">★</span>
            <span class="star-icon">★</span>
            <span class="star-icon">★</span>
            <span class="star-icon">★</span>
            <span class="star-icon">★</span>
          </div>
          <p class="rating-text">Penilaian Anda sangat berharga untuk peningkatan kualitas!</p>
        </div>
        
        <div class="button-container">
          <a href="http://localhost:4200/activity-page/handover-rating/${handoverId}" class="button">Berikan Penilaian Sekarang</a>
        </div>
        
        <p>Terima kasih atas perhatian dan kerjasama Anda.</p>
        <p>Pesan ini dikirim otomatis oleh sistem Go-Document. Jika ada pertanyaan, silakan hubungi tim support kami.</p>
      </div>
      
      <div class="footer">
        <p>© ${new Date().getFullYear()} Go-Document System</p>
        <p class="signature">Hormat kami,<br>Tim Go-Document System</p>
      </div>
    </div>
  </body>
  </html>
  `;
}

/**
 * Send confirmation email to the approver who submitted a rating
 */
export async function sendRatingConfirmationToApprover(
  approver: any,
  rating: number,
  projectName: string,
  docNumber: string,
  review: string
): Promise<void> {
  try {
    const email = approver.email;
    if (!email) {
      console.warn("⚠️ Cannot send confirmation email: approver has no email address");
      return;
    }

    const approverName = approver.employee_name || approver.employee_code || "Approver";
    const approverGender = getGenderTitle(approver.gender);
    const greeting = getGreeting();
    const ratingStars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    const currentDate = new Date().toLocaleDateString('id-ID');

    // Email subject
    const emailSubject = `[Go-Document] Konfirmasi Penilaian untuk ${projectName}`;

    // Email content
    const emailContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Go-Document System - Konfirmasi Penilaian</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0;
          background-color: #f9f9f9;
        }
        .container { 
          max-width: 650px; 
          margin: 0 auto; 
          padding: 20px;
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header { 
          text-align: center; 
          margin-bottom: 30px; 
          padding-bottom: 20px;
          border-bottom: 1px solid #eee;
        }
        .header h1 {
          color: #2c3e50;
          margin: 0;
          font-size: 28px;
        }
        .content { 
          margin-bottom: 30px; 
          padding: 0 10px;
        }
        .success-box {
          background-color: #d4edda;
          border-left: 4px solid #28a745;
          padding: 15px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .success-box p {
          color: #155724;
          margin: 0;
          font-weight: 500;
        }
        .document-title {
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
          border-left: 4px solid #007bff;
          font-weight: bold;
          font-size: 16px;
        }
        .rating-display {
          text-align: center;
          margin: 25px 0;
          padding: 15px;
          background-color: #fff8e1;
          border-radius: 8px;
          border: 1px solid #ffecb3;
        }
        .stars {
          font-size: 32px;
          color: #ffc107;
          letter-spacing: 5px;
        }
        .rating-text {
          margin-top: 10px;
          font-weight: 600;
          color: #856404;
        }
        .review-box {
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
          border-left: 4px solid #6c757d;
        }
        .review-text {
          font-style: italic;
          color: #555;
          margin: 0;
        }
        table.info-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 25px 0;
          border-radius: 5px;
          overflow: hidden;
          box-shadow: a 0 20px rgba(0,0,0,0.05);
        }
        .info-table th, .info-table td { 
          padding: 12px 15px; 
          text-align: left; 
          border-bottom: 1px solid #eee;
        }
        .info-table th { 
          background-color: #f8f9fa; 
          color: #333;
          font-weight: 600;
          width: 35%;
        }
        .footer { 
          margin-top: 40px; 
          padding-top: 20px;
          border-top: 1px solid #eee;
          text-align: center;
          font-size: 14px;
          color: #6c757d;
        }
        .footer p {
          margin: 5px 0;
        }
        .signature {
          margin-top: 15px;
          font-weight: 600;
          color: #495057;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Go-Document System</h1>
        </div>
        
        <div class="content">
          <p>${greeting}</p>
          <p>Yth. ${approverGender} ${approverName},</p>
          
          <div class="success-box">
            <p><strong>Terima kasih!</strong> Penilaian Anda untuk dokumen handover telah berhasil disimpan.</p>
          </div>
          
          <p>Berikut ringkasan penilaian yang telah Anda berikan:</p>
          
          <div class="document-title">
            ${projectName} - ${docNumber}
          </div>
          
          <div class="rating-display">
            <div class="stars">${ratingStars}</div>
            <p class="rating-text">Penilaian: ${rating} dari 5</p>
          </div>
          
          ${review ? `
          <div class="review-box">
            <p class="review-text">"${review}"</p>
          </div>
          ` : ''}
          
          <table class="info-table">
            <tr>
              <th>Tanggal Penilaian</th>
              <td>${currentDate}</td>
            </tr>
            <tr>
              <th>Status</th>
              <td>Tersimpan</td>
            </tr>
          </table>
          
          <p>Terima kasih atas kontribusi Anda dalam meningkatkan kualitas proses handover di sistem kami.</p>
          <p>Pesan ini dikirim otomatis oleh sistem Go-Document. Jika ada pertanyaan, silakan hubungi tim support kami.</p>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Go-Document System</p>
          <p class="signature">Hormat kami,<br>Tim Go-Document System</p>
        </div>
      </div>
    </body>
    </html>
    `;

    // Send the email
    await sendEmail({
      to: email,
      subject: emailSubject,
      html: emailContent
    });

    console.log(`✉️ Rating confirmation email sent to approver: ${email}`);

  } catch (error) {
    console.error("❌ Error sending approver confirmation email:", error);
    throw error;
  }
}

/**
 * Send summary email to the submitter when all ratings are complete
 */
function renderStars(rating: number): string {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.25 && rating - fullStars < 0.75;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  let stars = '★'.repeat(fullStars);
  if (hasHalfStar) stars += '⯨'; // simbol setengah bintang, bisa diganti
  stars += '☆'.repeat(emptyStars);

  return stars;
}

export async function sendRatingSummaryToSubmitter(
  submitter: any,
  handoverId: number,
  projectName: string,
  docNumber: string,
  averageRating: number,
  totalApprovers: number
): Promise<void> {
  try {
    const email = submitter.email;
    if (!email) {
      console.warn("⚠️ Cannot send summary email: submitter has no email address");
      return;
    }

    const submitterName = submitter.employee_name || submitter.employee_code || "Submitter";
    const submitterGender = getGenderTitle(submitter.gender);
    const greeting = getGreeting();
    const ratingStars = renderStars(averageRating);
    const currentDate = new Date().toLocaleDateString('id-ID');

    const approvals = await repo.findRatedApprovalsWithAuth(handoverId);

    let approverFeedbackHtml = '';
    for (const approval of approvals) {
      const approverName = approval.mst_authorization?.employee_name || approval.employee_code || "Approver";
      const approverRating = approval.rating || 0;
      const approverStars = renderStars(approverRating);
      const approverReview = approval.review || "(Tidak ada ulasan)";

      approverFeedbackHtml += `
      <div class="approver-feedback">
        <div class="approver-header">
          <span class="approver-name">${approverName}</span>
          <span class="approver-stars">${approverStars}</span>
        </div>
        <p class="approver-review">"${approverReview}"</p>
      </div>
      `;
    }


    // Email subject
    const emailSubject = `[Go-Document] Ringkasan Penilaian untuk ${projectName}`;

    // Email content
    const emailContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Go-Document System - Ringkasan Penilaian</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0; 
          padding: 0;
          background-color: #f9f9f9;
        }
        .container { 
          max-width: 650px; 
          margin: 0 auto; 
          padding: 20px;
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header { 
          text-align: center; 
          margin-bottom: 30px; 
          padding-bottom: 20px;
          border-bottom: 1px solid #eee;
        }
        .header h1 {
          color: #2c3e50;
          margin: 0;
          font-size: 28px;
        }
        .content { 
          margin-bottom: 30px; 
          padding: 0 10px;
        }
        .complete-box {
          background-color: #d4edda;
          border-left: 4px solid #28a745;
          padding: 15px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .complete-box p {
          color: #155724;
          margin: 0;
          font-weight: 500;
        }
        .document-title {
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
          border-left: 4px solid #007bff;
          font-weight: bold;
          font-size: 16px;
        }
        .rating-summary {
          text-align: center;
          margin: 25px 0;
          padding: 20px;
          background-color: #fff8e1;
          border-radius: 8px;
          border: 1px solid #ffecb3;
        }
        .rating-big {
          font-size: 48px;
          font-weight: bold;
          color: #ffc107;
        }
        .stars-big {
          font-size: 36px;
          color: #ffc107;
          letter-spacing: 5px;
          margin: 10px 0;
        }
        .rating-text {
          margin-top: 10px;
          font-weight: 600;
          color: #856404;
        }
        .approver-feedback {
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 5px;
          margin: 15px 0;
          border-left: 4px solid #6c757d;
        }
        .approver-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .approver-name {
          font-weight: bold;
          color: #495057;
        }
        .approver-stars {
          color: #ffc107;
        }
        .approver-review {
          font-style: italic;
          color: #555;
          margin: 0;
        }
        .feedback-section {
          margin: 30px 0;
        }
        .section-title {
          font-size: 18px;
          color: #333;
          margin-bottom: 15px;
          padding-bottom: 5px;
          border-bottom: 1px solid #eee;
        }
        table.summary-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 25px 0;
          border-radius: 5px;
          overflow: hidden;
          box-shadow: 0 0 20px rgba(0,0,0,0.05);
        }
        .summary-table th, .summary-table td { 
          padding: 12px 15px; 
          text-align: left; 
          border-bottom: 1px solid #eee;
        }
        .summary-table th { 
          background-color: #f8f9fa; 
          color: #333;
          font-weight: 600;
          width: 35%;
        }
        .footer { 
          margin-top: 40px; 
          padding-top: 20px;
          border-top: 1px solid #eee;
          text-align: center;
          font-size: 14px;
          color: #6c757d;
        }
        .footer p {
          margin: 5px 0;
        }
        .signature {
          margin-top: 15px;
          font-weight: 600;
          color: #495057;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Go-Document System</h1>
        </div>
        
        <div class="content">
          <p>${greeting}</p>
          <p>Yth. ${submitterGender} ${submitterName},</p>
          
          <div class="complete-box">
            <p><strong>Selamat!</strong> Semua penilaian untuk dokumen handover Anda telah lengkap.</p>
          </div>
          
          <p>Berikut ringkasan penilaian untuk dokumen:</p>
          
          <div class="document-title">
            ${projectName} - ${docNumber}
          </div>
          
          <div class="rating-summary">
            <div class="rating-big">${averageRating}/5</div>
            <div class="stars-big">${ratingStars}</div>
            <p class="rating-text">Penilaian rata-rata dari ${totalApprovers} approver</p>
          </div>
          
          <table class="summary-table">
            <tr>
              <th>Tanggal Selesai</th>
              <td>${currentDate}</td>
            </tr>
            <tr>
              <th>Status</th>
              <td>Selesai</td>
            </tr>
            <tr>
              <th>Jumlah Penilai</th>
              <td>${totalApprovers} orang</td>
            </tr>
          </table>
          
          <div class="feedback-section">
            <h3 class="section-title">Ulasan dan Komentar</h3>
            ${approverFeedbackHtml}
          </div>
          
          <p>Terima kasih atas partisipasi Anda dalam proses handover. Penilaian ini akan digunakan untuk meningkatkan kualitas proses handover di masa mendatang.</p>
          <p>Pesan ini dikirim otomatis oleh sistem Go-Document. Jika ada pertanyaan, silakan hubungi tim support kami.</p>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Go-Document System</p>
          <p class="signature">Hormat kami,<br>Tim Go-Document System</p>
        </div>
      </div>
    </body>
    </html>
    `;

    // Send the email
    await sendEmail({
      to: email,
      subject: emailSubject,
      html: emailContent
    });

    console.log(`✉️ Rating summary email sent to submitter: ${email}`);

  } catch (error) {
    console.error("❌ Error sending submitter summary email:", error);
    throw error;
  }
}
