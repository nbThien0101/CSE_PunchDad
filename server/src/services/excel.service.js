const ExcelJS = require('exceljs');

/**
 * Format date to Vietnamese format: DD/MM/YYYY HH:mm
 */
const formatDateTime = (date) => {
  if (!date) return 'Chưa cập nhật';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Chưa cập nhật';
  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Generate Excel workbook buffer containing members and pending requests
 * @param {Object} options
 * @param {Array} options.members List of approved members
 * @param {Array} options.pendingRequests List of pending join requests
 * @param {string} options.exportedBy Name of admin exporting the file
 * @returns {Promise<Buffer>}
 */
const generateMembersExcelWorkbook = async ({ members = [], pendingRequests = [], exportedBy = 'Admin' }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CSE HitDad FC';
  workbook.created = new Date();
  workbook.modified = new Date();

  const primaryFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // Dark slate
  };

  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F766E' }, // Emerald / Teal
  };

  const pendingHeaderFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD97706' }, // Amber / Warm orange
  };

  const zebraFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF8FAFC' }, // Light gray/blue
  };

  const whiteFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFFFF' },
  };

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  // ==========================================================
  // SHEET 1: Danh sách thành viên chính thức
  // ==========================================================
  const wsMembers = workbook.addWorksheet('Danh sách thành viên', {
    views: [{ showGridLines: true }],
  });

  // Define columns
  wsMembers.columns = [
    { key: 'stt', width: 8 },
    { key: 'displayName', width: 28 },
    { key: 'username', width: 20 },
    { key: 'email', width: 30 },
    { key: 'phone', width: 18 },
    { key: 'role', width: 18 },
    { key: 'tier', width: 18 },
    { key: 'goalkeeper', width: 16 },
    { key: 'bankInfo', width: 34 },
    { key: 'matchCount', width: 18 },
    { key: 'status', width: 18 },
    { key: 'createdAt', width: 22 },
  ];

  // Title Banner
  wsMembers.mergeCells('A1:L1');
  const titleCell = wsMembers.getCell('A1');
  titleCell.value = 'CLB BÓNG ĐÁ CSE HITDAD - DANH SÁCH THÀNH VIÊN';
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = primaryFill;
  wsMembers.getRow(1).height = 40;

  // Subtitle / Export info
  wsMembers.mergeCells('A2:L2');
  const subCell = wsMembers.getCell('A2');
  subCell.value = `Thời gian xuất: ${formatDateTime(new Date())}   |   Người xuất: ${exportedBy} (Admin)   |   Tổng cộng: ${members.length} thành viên`;
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  wsMembers.getRow(2).height = 24;

  // Blank spacing row
  wsMembers.getRow(3).height = 10;

  // Table Headers
  const memberHeaders = [
    'STT',
    'Họ và tên',
    'Tên tài khoản',
    'Email',
    'Số điện thoại',
    'Vai trò',
    'Hạng trình độ',
    'Vị trí',
    'Thông tin ngân hàng',
    'Số trận tham gia',
    'Trạng thái',
    'Ngày gia nhập',
  ];

  const headerRow = wsMembers.getRow(4);
  headerRow.height = 30;
  memberHeaders.forEach((headerText, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = headerText;
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = headerFill;
    cell.border = thinBorder;
  });

  // Populate Members Data
  let currentRowIndex = 5;
  let totalMatches = 0;
  let totalAdmins = 0;
  let totalGoalkeepers = 0;
  let totalWithTier = 0;

  members.forEach((member, idx) => {
    const row = wsMembers.getRow(currentRowIndex);
    row.height = 24;
    const isEven = idx % 2 === 0;
    const rowFill = isEven ? whiteFill : zebraFill;

    const matches = member._count?.votes || 0;
    totalMatches += matches;
    if (member.role === 'ADMIN') totalAdmins++;
    if (member.isGoalkeeper) totalGoalkeepers++;
    if (member.tier) totalWithTier++;

    const rowData = [
      idx + 1,
      member.displayName || 'Chưa cập nhật',
      member.username ? `@${member.username}` : '',
      member.email || 'Chưa cập nhật',
      member.phone || 'Chưa cập nhật',
      member.role === 'ADMIN' ? 'Ban cán sự' : 'Thành viên',
      member.tier ? `Tier ${member.tier}` : 'Chưa xếp hạng',
      member.isGoalkeeper ? '🧤 Thủ môn' : 'Cầu thủ',
      member.bankInfo || 'Chưa cập nhật',
      matches,
      member.membershipStatus === 'APPROVED' ? 'Chính thức' : (member.membershipStatus || 'Chính thức'),
      formatDateTime(member.createdAt),
    ];

    rowData.forEach((val, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = val;
      cell.font = { name: 'Arial', size: 10 };
      cell.fill = rowFill;
      cell.border = thinBorder;

      // Alignments
      if (colIdx === 0 || colIdx === 4 || colIdx === 5 || colIdx === 6 || colIdx === 7 || colIdx === 9 || colIdx === 10 || colIdx === 11) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      // Highlight Admin badge
      if (colIdx === 5 && member.role === 'ADMIN') {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFD97706' } };
      }

      // Highlight GK
      if (colIdx === 7 && member.isGoalkeeper) {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF059669' } };
      }
    });

    currentRowIndex++;
  });

  // Summary Row
  const summaryRow = wsMembers.getRow(currentRowIndex);
  summaryRow.height = 28;
  wsMembers.mergeCells(`A${currentRowIndex}:E${currentRowIndex}`);
  const summaryTitleCell = summaryRow.getCell(1);
  summaryTitleCell.value = 'TỔNG CỘNG THỐNG KÊ';
  summaryTitleCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
  summaryTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summaryTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  for (let c = 1; c <= 5; c++) summaryRow.getCell(c).border = thinBorder;

  // Admin stats
  const adminStatCell = summaryRow.getCell(6);
  adminStatCell.value = `${totalAdmins} BCS`;
  adminStatCell.font = { name: 'Arial', size: 10, bold: true };
  adminStatCell.alignment = { vertical: 'middle', horizontal: 'center' };
  adminStatCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  adminStatCell.border = thinBorder;

  // Tier stats
  const tierStatCell = summaryRow.getCell(7);
  tierStatCell.value = `${totalWithTier} có Tier`;
  tierStatCell.font = { name: 'Arial', size: 10, bold: true };
  tierStatCell.alignment = { vertical: 'middle', horizontal: 'center' };
  tierStatCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  tierStatCell.border = thinBorder;

  // GK stats
  const gkStatCell = summaryRow.getCell(8);
  gkStatCell.value = `${totalGoalkeepers} GK`;
  gkStatCell.font = { name: 'Arial', size: 10, bold: true };
  gkStatCell.alignment = { vertical: 'middle', horizontal: 'center' };
  gkStatCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  gkStatCell.border = thinBorder;

  // Bank column
  const bankBlankCell = summaryRow.getCell(9);
  bankBlankCell.value = '';
  bankBlankCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  bankBlankCell.border = thinBorder;

  // Matches total
  const matchStatCell = summaryRow.getCell(10);
  matchStatCell.value = `${totalMatches} lượt`;
  matchStatCell.font = { name: 'Arial', size: 10, bold: true };
  matchStatCell.alignment = { vertical: 'middle', horizontal: 'center' };
  matchStatCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  matchStatCell.border = thinBorder;

  // Status & Date blanks
  wsMembers.mergeCells(`K${currentRowIndex}:L${currentRowIndex}`);
  const statusBlankCell = summaryRow.getCell(11);
  statusBlankCell.value = `${members.length} thành viên`;
  statusBlankCell.font = { name: 'Arial', size: 10, bold: true };
  statusBlankCell.alignment = { vertical: 'middle', horizontal: 'center' };
  statusBlankCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  summaryRow.getCell(11).border = thinBorder;
  summaryRow.getCell(12).border = thinBorder;

  // ==========================================================
  // SHEET 2: Yêu cầu gia nhập chờ duyệt
  // ==========================================================
  const wsPending = workbook.addWorksheet('Yêu cầu chờ duyệt', {
    views: [{ showGridLines: true }],
  });

  wsPending.columns = [
    { key: 'stt', width: 8 },
    { key: 'displayName', width: 28 },
    { key: 'username', width: 20 },
    { key: 'email', width: 30 },
    { key: 'phone', width: 20 },
    { key: 'createdAt', width: 24 },
    { key: 'status', width: 18 },
  ];

  // Title Banner
  wsPending.mergeCells('A1:G1');
  const pendingTitleCell = wsPending.getCell('A1');
  pendingTitleCell.value = 'DANH SÁCH YÊU CẦU THAM GIA CLB ĐANG CHỜ DUYỆT';
  pendingTitleCell.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  pendingTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  pendingTitleCell.fill = primaryFill;
  wsPending.getRow(1).height = 40;

  // Subtitle
  wsPending.mergeCells('A2:G2');
  const pendingSubCell = wsPending.getCell('A2');
  pendingSubCell.value = `Số lượng yêu cầu đang chờ duyệt: ${pendingRequests.length}`;
  pendingSubCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
  pendingSubCell.alignment = { vertical: 'middle', horizontal: 'center' };
  pendingSubCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  wsPending.getRow(2).height = 24;

  wsPending.getRow(3).height = 10;

  // Headers
  const pendingHeaders = [
    'STT',
    'Họ và tên',
    'Tên tài khoản',
    'Email',
    'Số điện thoại',
    'Thời gian đăng ký',
    'Trạng thái',
  ];

  const pendingHeaderRow = wsPending.getRow(4);
  pendingHeaderRow.height = 30;
  pendingHeaders.forEach((text, i) => {
    const cell = pendingHeaderRow.getCell(i + 1);
    cell.value = text;
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.fill = pendingHeaderFill;
    cell.border = thinBorder;
  });

  if (pendingRequests.length === 0) {
    wsPending.mergeCells('A5:G5');
    const emptyCell = wsPending.getCell('A5');
    emptyCell.value = 'Hiện không có yêu cầu tham gia nào đang chờ duyệt.';
    emptyCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
    emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
    emptyCell.border = thinBorder;
    wsPending.getRow(5).height = 30;
  } else {
    pendingRequests.forEach((req, idx) => {
      const pRowIndex = 5 + idx;
      const pRow = wsPending.getRow(pRowIndex);
      pRow.height = 24;
      const isEven = idx % 2 === 0;
      const pFill = isEven ? whiteFill : zebraFill;

      const pData = [
        idx + 1,
        req.displayName || 'Chưa cập nhật',
        req.username ? `@${req.username}` : '',
        req.email || 'Chưa cập nhật',
        req.phone || 'Chưa cập nhật',
        formatDateTime(req.createdAt),
        'Chờ duyệt',
      ];

      pData.forEach((val, cIdx) => {
        const cell = pRow.getCell(cIdx + 1);
        cell.value = val;
        cell.font = { name: 'Arial', size: 10 };
        cell.fill = pFill;
        cell.border = thinBorder;
        if (cIdx === 0 || cIdx === 4 || cIdx === 5 || cIdx === 6) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

module.exports = {
  generateMembersExcelWorkbook,
  formatDateTime,
};
