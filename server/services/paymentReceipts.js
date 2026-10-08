const db = require("../db");

const receiptSelect = `
  SELECT p.id AS payment_id,
         p.session_request_id,
         p.amount::text AS amount,
         p.currency,
         p.paid_at,
         p.provider_reference,
         sr.subject,
         sr.requested_date AS session_date,
         student.first_name AS student_first_name,
         student.last_name AS student_last_name,
         student.email AS student_email,
         tutor.first_name AS tutor_first_name,
         tutor.last_name AS tutor_last_name
  FROM payments p
  INNER JOIN session_requests sr ON sr.id = p.session_request_id
  INNER JOIN users student ON student.id = p.student_id
  INNER JOIN users tutor ON tutor.id = p.tutor_id
  WHERE p.payment_status = 'PAID'
`;

function serializeReceipt(row) {
  return {
    receiptNumber: `EL-RCPT-${row.payment_id}`,
    sessionRequestId: row.session_request_id,
    paymentDate: row.paid_at,
    studentName: `${row.student_first_name} ${row.student_last_name}`.trim(),
    studentEmail: row.student_email,
    tutorName: `${row.tutor_first_name} ${row.tutor_last_name}`.trim(),
    subject: row.subject,
    sessionDate: row.session_date,
    amount: row.amount,
    currency: row.currency,
    paymentStatus: "PAID",
    paymentReference: row.provider_reference
  };
}

async function getReceiptByPaymentId(paymentId) {
  const result = await db.query(`${receiptSelect} AND p.id = $1`, [paymentId]);
  return result.rows[0] ? serializeReceipt(result.rows[0]) : null;
}

async function getStudentReceiptBySessionRequestId(sessionRequestId, studentId) {
  const result = await db.query(
    `${receiptSelect} AND p.session_request_id = $1 AND p.student_id = $2`,
    [sessionRequestId, studentId]
  );
  return result.rows[0] ? serializeReceipt(result.rows[0]) : null;
}

module.exports = {
  getReceiptByPaymentId,
  getStudentReceiptBySessionRequestId
};
