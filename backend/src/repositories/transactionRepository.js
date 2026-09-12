const pool = require("../config/database");

async function findById(
  organizationId,
  transactionId,
  connection = pool
) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        organization_id,
        activity_id,
        transaction_reference,
        transaction_type,
        amount,
        currency,
        status,
        transaction_date,
        created_by,
        created_at,
        updated_at
      FROM transactions
      WHERE organization_id = ?
        AND id = ?
      LIMIT 1
    `,
    [
      organizationId,
      transactionId,
    ]
  );

  return rows[0] || null;
}

async function updateStatus(
  organizationId,
  transactionId,
  status,
  connection = pool
) {
  const [result] = await connection.execute(
    `
      UPDATE transactions
      SET status = ?
      WHERE organization_id = ?
        AND id = ?
    `,
    [
      status,
      organizationId,
      transactionId,
    ]
  );

  return result.affectedRows;
}

module.exports = {
  findById,
  updateStatus,
};
