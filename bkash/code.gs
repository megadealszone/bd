const SPREADSHEET_ID = "1SeELq58heEC-bZ3FTv9MuuiiR9ZvRcsN2DtSRINRdd4";

function setupSystem() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ["Dashboard", "Users", "Transactions", "Customers", "Daily_Report", "Monthly_Report", "Balance", "Settings", "Audit_Log", "Notifications"];
  sheets.forEach(name => { if (!ss.getSheetByName(name)) ss.insertSheet(name); });

  const userSheet = ss.getSheetByName("Users");
  if (userSheet.getLastRow() === 0) userSheet.appendRow(["Username", "PasswordHash", "Role", "Status", "Created At"]);

  const txnSheet = ss.getSheetByName("Transactions");
  if (txnSheet.getLastRow() === 0) {
    txnSheet.appendRow(["Transaction ID", "Date", "Time", "Transaction Type", "Customer Name", "Customer Mobile", "Sender Name", "Sender Mobile", "Receiver Name", "Receiver Mobile", "Bill Account", "Meter Number", "Amount", "Service Charge", "Agent Profit", "Reference Number", "Remarks", "Balance Before", "Balance After", "Created By", "Created At", "Status"]);
  }
  
  const auditSheet = ss.getSheetByName("Audit_Log");
  if(auditSheet.getLastRow() === 0) auditSheet.appendRow(["Timestamp", "User", "Action", "Details"]);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    let result = {};

    switch (data.action) {
      case 'login': result = handleLogin(data); break;
      case 'signup': result = handleSignup(data); break;
      case 'add_transaction': result = addTransaction(data); break;
      case 'get_dashboard': result = getDashboardData(data); break;
      case 'update_transaction': result = updateTransaction(data); break;
      case 'delete_transactions': result = deleteTransactions(data); break;
      default: result = { status: "error", message: "Invalid action" };
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function sha256(rawPassword) {
  const signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, rawPassword);
  return signature.map(byte => (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0')).join('');
}

function handleSignup(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const userSheet = ss.getSheetByName("Users");
  const users = userSheet.getDataRange().getValues();
  for (let i = 1; i < users.length; i++) {
    if (users[i][0] === data.username) return { status: "error", message: "Username already exists!" };
  }
  userSheet.appendRow([data.username, sha256(data.password), data.role || "Operator", "Active", new Date()]);
  logAction(data.username, "Registration", "New user registered");
  return { status: "success", message: "Registration Successful" };
}

function handleLogin(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const userSheet = ss.getSheetByName("Users");
  const users = userSheet.getDataRange().getValues();
  const hashedPassword = sha256(data.password);
  for (let i = 1; i < users.length; i++) {
    if (users[i][0] === data.username && users[i][1] === hashedPassword) {
      logAction(data.username, "Login", "User logged in");
      return { status: "success", user: { username: users[i][0], role: users[i][2] } };
    }
  }
  return { status: "error", message: "Invalid Username or Password" };
}

function addTransaction(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const txnSheet = ss.getSheetByName("Transactions");
    const lastRow = txnSheet.getLastRow();
    
    const today = new Date();
    const dateString = Utilities.formatDate(today, "GMT+6", "yyyyMMdd");
    let count = 1;
    if (lastRow > 1) {
      const lastTxnId = txnSheet.getRange(lastRow, 1).getValue();
      if (lastTxnId.includes(dateString)) count = parseInt(lastTxnId.split("-")[2]) + 1;
    }
    const txnId = `TXN-${dateString}-${count.toString().padStart(6, '0')}`;
    const dDate = Utilities.formatDate(today, "GMT+6", "yyyy-MM-dd");
    const dTime = Utilities.formatDate(today, "GMT+6", "HH:mm:ss");
    
    let balanceBefore = lastRow > 1 ? parseFloat(txnSheet.getRange(lastRow, 19).getValue() || 0) : 0;
    let amount = parseFloat(data.amount || 0);
    let charge = parseFloat(data.service_charge || 0);
    let profit = parseFloat(data.agent_profit || 0);
    
    let balanceAfter = balanceBefore;
    if (data.txn_type === "bKash Cash In" || data.txn_type === "bKash Send Money" || data.txn_type === "Personal Expense (ব্যক্তিগত খরচ)") {
      balanceAfter = balanceBefore - amount + charge; 
    } else {
      balanceAfter = balanceBefore + amount + charge; 
    }

    txnSheet.appendRow([
      txnId, dDate, dTime, data.txn_type, data.customer_name || "", data.customer_mobile || "",
      data.sender_name || "", data.sender_mobile || "", data.receiver_name || "", data.receiver_mobile || "",
      data.bill_account || "", data.meter_number || "", amount, charge, profit, data.reference || "",
      data.remarks || "", balanceBefore, balanceAfter, data.user, new Date(), "Completed"
    ]);
    
    logAction(data.user, "Transaction Create", `Created ${txnId}`);
    return { status: "success", message: "লেনদেন সফলভাবে সংরক্ষণ ও সংরক্ষণ করা হয়েছে!", txnId: txnId };
  } catch (err) {
    return { status: "error", message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function updateTransaction(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const txnSheet = ss.getSheetByName("Transactions");
    const ids = txnSheet.getRange(2, 1, txnSheet.getLastRow() - 1, 1).getValues().flat();
    const rowIndex = ids.indexOf(data.txn_id) + 2;
    
    if (rowIndex < 2) return { status: "error", message: "Transaction not found." };
    
    txnSheet.getRange(rowIndex, 4, 1, 14).setValues([[
      data.txn_type, data.customer_name || "", data.customer_mobile || "",
      data.sender_name || "", data.sender_mobile || "", data.receiver_name || "", data.receiver_mobile || "",
      data.bill_account || "", data.meter_number || "", parseFloat(data.amount || 0), parseFloat(data.service_charge || 0), parseFloat(data.agent_profit || 0), data.reference || "", data.remarks || ""
    ]]);
    
    recalculateBalances(rowIndex, txnSheet);
    logAction(data.user, "Transaction Update", `Updated ${data.txn_id}`);
    return { status: "success", message: "লেনদেন সফলভাবে আপডেট হয়েছে!" };
  } catch (err) {
    return { status: "error", message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteTransactions(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const txnSheet = ss.getSheetByName("Transactions");
    const ids = txnSheet.getRange(2, 1, txnSheet.getLastRow() - 1, 1).getValues().flat();
    
    let rowsToDelete = [];
    data.txn_ids.forEach(id => {
      let idx = ids.indexOf(id);
      if(idx !== -1) rowsToDelete.push(idx + 2);
    });
    
    if (rowsToDelete.length === 0) return { status: "error", message: "No matching transactions found." };
    
    rowsToDelete.sort((a, b) => b - a); 
    const firstAffectedRow = rowsToDelete[rowsToDelete.length - 1];
    
    rowsToDelete.forEach(r => txnSheet.deleteRow(r));
    
    recalculateBalances(firstAffectedRow, txnSheet);
    logAction(data.user, "Transaction Delete", `Deleted IDs: ${data.txn_ids.join(', ')}`);
    return { status: "success", message: "নির্বাচিত লেনদেনগুলো সফলভাবে ডিলেট হয়েছে!" };
  } catch (err) {
    return { status: "error", message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function recalculateBalances(startRowIndex, txnSheet) {
  const lastRow = txnSheet.getLastRow();
  if (startRowIndex > lastRow) return;
  if (startRowIndex < 2) startRowIndex = 2;

  let previousBalance = 0;
  if (startRowIndex > 2) {
    previousBalance = parseFloat(txnSheet.getRange(startRowIndex - 1, 19).getValue() || 0);
  }

  const range = txnSheet.getRange(startRowIndex, 1, lastRow - startRowIndex + 1, 22);
  const values = range.getValues();

  for (let i = 0; i < values.length; i++) {
    let type = values[i][3];
    let amount = parseFloat(values[i][12] || 0);
    let charge = parseFloat(values[i][13] || 0);
    
    let balanceBefore = previousBalance;
    let balanceAfter = balanceBefore;

    if (type === "bKash Cash In" || type === "bKash Send Money" || type === "Personal Expense (ব্যক্তিগত খরচ)") {
      balanceAfter = balanceBefore - amount + charge;
    } else {
      balanceAfter = balanceBefore + amount + charge;
    }

    values[i][17] = balanceBefore;
    values[i][18] = balanceAfter;
    previousBalance = balanceAfter;
  }
  range.setValues(values);
}

function getDashboardData(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const txnSheet = ss.getSheetByName("Transactions");
  const txns = txnSheet.getDataRange().getValues();
  
  if (txns.length <= 1) return { status: "success", stats: {}, txns: [] };

  const headers = txns.shift();
  let todayTotalTxn = 0, todayAmount = 0, todayProfit = 0, todayExpense = 0, currentBalance = 0;
  const today = Utilities.formatDate(new Date(), "GMT+6", "yyyy-MM-dd");
  
  let formattedTxns = txns.map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    if (obj["Date"] === today) {
      todayTotalTxn++;
      if (obj["Transaction Type"] === "Personal Expense (ব্যক্তিগত খরচ)") {
          todayExpense += parseFloat(obj["Amount"] || 0);
      } else {
          todayAmount += parseFloat(obj["Amount"] || 0);
          todayProfit += parseFloat(obj["Agent Profit"] || 0);
      }
    }
    return obj;
  }).reverse();

  if(txns.length > 0) currentBalance = txns[txns.length - 1][18];

  return {
    status: "success",
    stats: { todayTotalTxn, todayAmount, todayProfit, todayExpense, currentBalance },
    txns: formattedTxns 
  };
}

function logAction(user, action, details) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ss.getSheetByName("Audit_Log").appendRow([new Date(), user, action, details]);
}