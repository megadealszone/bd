// ==========================================
// CONFIGURATION
// ==========================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbyzSxCslvQcK_kcqu-ZDrux4QKYAWUi1P9W-u12pS8brnAoh9jX-2K6seHGva7LfQGqxQ/exec"; // আপনার Web App URL দিন

let currentUser = null;
let txnTable, manageTable;
let globalTxns = [];

// Reusable Form HTML with Total Amount right next to Profit
const formHTML = (prefix = "") => `
    <div class="col-md-4">
        <label>Transaction Type *</label>
        <select class="form-select" id="${prefix}txn_type" required onchange="toggleFields('${prefix}'); calculateCharges('${prefix}');">
            <option value="">Select Type</option>
            <option value="bKash Cash In">bKash Cash In</option>
            <option value="bKash Send Money">bKash Send Money</option>
            <option value="bKash Cash Out">bKash Cash Out</option>
            <option value="bKash Bank Transfer">bKash Bank Transfer</option>
            <option value="bKash Electricity Bill Payment">bKash Electricity Bill Payment</option>
            <option value="Personal Expense (ব্যক্তিগত খরচ)">Personal Expense (ব্যক্তিগত খরচ)</option>
        </select>
    </div>
    <div class="col-md-4 ${prefix}f-customer d-none"><label>Customer Name</label><input type="text" class="form-control" id="${prefix}customer_name"></div>
    <div class="col-md-4 ${prefix}f-customer d-none"><label>Customer Mobile</label><input type="text" class="form-control" id="${prefix}customer_mobile"></div>
    <div class="col-md-4 ${prefix}f-sender d-none"><label>Sender Name</label><input type="text" class="form-control" id="${prefix}sender_name"></div>
    <div class="col-md-4 ${prefix}f-sender d-none"><label>Sender Mobile</label><input type="text" class="form-control" id="${prefix}sender_mobile"></div>
    <div class="col-md-4 ${prefix}f-receiver d-none"><label>Receiver Name</label><input type="text" class="form-control" id="${prefix}receiver_name"></div>
    <div class="col-md-4 ${prefix}f-receiver d-none"><label>Receiver Mobile</label><input type="text" class="form-control" id="${prefix}receiver_mobile"></div>
    <div class="col-md-4 ${prefix}f-bill d-none"><label>Bill Account</label><input type="text" class="form-control" id="${prefix}bill_account"></div>
    <div class="col-md-4 ${prefix}f-bill d-none"><label>Meter Number</label><input type="text" class="form-control" id="${prefix}meter_number"></div>
    <div class="col-md-4"><label>Amount (৳) *</label><input type="number" step="0.01" class="form-control" id="${prefix}amount" required oninput="calculateCharges('${prefix}')"></div>
    <div class="col-md-4"><label>Service Charge (৳)</label><input type="number" step="0.01" class="form-control" id="${prefix}service_charge" value="0" oninput="calculateProfitFromCharge('${prefix}')"></div>
    <div class="col-md-4"><label>Agent Profit (৳)</label><input type="number" step="0.01" class="form-control" id="${prefix}agent_profit" value="0" oninput="calculateTotalAmount('${prefix}')"></div>
    <div class="col-md-4"><label>Total Amount (৳)</label><input type="number" step="0.01" class="form-control" id="${prefix}total_amount" value="0" readonly></div>
    <div class="col-md-4"><label>Reference Number</label><input type="text" class="form-control" id="${prefix}reference"></div>
    <div class="col-md-8"><label>Remarks (যাতায়াত/বিবরণ)</label><input type="text" class="form-control" id="${prefix}remarks"></div>
`;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("formFieldsContainer").innerHTML = formHTML("");
    document.getElementById("editFormFieldsContainer").innerHTML = formHTML("edit_");
    
    const session = localStorage.getItem("bkash_session");
    if(session) {
        currentUser = JSON.parse(session);
        document.getElementById("user-display").innerText = "Hi, " + currentUser.username;
        document.getElementById("auth").classList.add("d-none");
        document.getElementById("app").classList.remove("d-none");
        loadDashboard();
    }
});

// ==========================================
// CALCULATION LOGIC (Amount -> Charge -> Profit -> Total)
// ==========================================
window.calculateCharges = function(prefix = "") {
    const type = $(`#${prefix}txn_type`).val();
    const amount = parseFloat($(`#${prefix}amount`).val()) || 0;
    
    if (!type) return; 

    let charge = 0;
    let profit = 0;
    
    // Auto-calculating default service charge (Can be edited manually later)
    if (type === "Personal Expense (ব্যক্তিগত খরচ)") {
        charge = 0;
    } else if (type === "bKash Bank Transfer" && amount > 0) {
        charge = (amount / 1000) * 8.50; 
    } else if (amount > 0) {
        charge = (amount / 1000) * 15; 
    }
    
    // আপনার দেওয়া নতুন ফর্মুলা অনুযায়ী Agent Profit বের করা হচ্ছে
    if (type === "Personal Expense (ব্যক্তিগত খরচ)") {
        profit = 0;
    } else {
        profit = (amount * charge) / 1000;
    }
    
    if(amount >= 0) {
        $(`#${prefix}service_charge`).val(charge.toFixed(2));
        $(`#${prefix}agent_profit`).val(profit.toFixed(2));
        calculateTotalAmount(prefix);
    }
};

// যখন সার্ভিস চার্জ ম্যানুয়ালি পরিবর্তন করা হবে, তখন আপনার ফর্মুলা অনুযায়ী প্রফিট আপডেট হবে
window.calculateProfitFromCharge = function(prefix = "") {
    const type = $(`#${prefix}txn_type`).val();
    const amount = parseFloat($(`#${prefix}amount`).val()) || 0;
    const charge = parseFloat($(`#${prefix}service_charge`).val()) || 0;
    
    // Amount * Service Charge / 1000 = Agent Profit
    let profit = (amount * charge) / 1000;
    
    if (type === "Personal Expense (ব্যক্তিগত খরচ)") {
        profit = 0;
    }
    
    $(`#${prefix}agent_profit`).val(profit.toFixed(2));
    calculateTotalAmount(prefix);
};

window.calculateTotalAmount = function(prefix = "") {
    const amount = parseFloat($(`#${prefix}amount`).val()) || 0;
    const profit = parseFloat($(`#${prefix}agent_profit`).val()) || 0;
    const total = amount + profit;
    $(`#${prefix}total_amount`).val(total.toFixed(2));
};

function resetFormCustom() {
    document.getElementById("txnForm").reset();
    toggleFields("");
    calculateCharges("");
}

// ==========================================
// AUTHENTICATION
// ==========================================
let authMode = 'login';
function switchAuth(mode) {
    authMode = mode;
    document.getElementById("btn-tab-login").classList.toggle("active", mode === 'login');
    document.getElementById("btn-tab-signup").classList.toggle("active", mode === 'signup');
    document.getElementById("auth_role").classList.toggle("d-none", mode === 'login');
    document.getElementById("btn-auth").innerText = mode === 'login' ? "Login" : "Sign Up";
}

function handleAuth(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-auth");
    btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
    
    const payload = {
        action: authMode,
        username: $("#auth_user").val(),
        password: $("#auth_pass").val(),
        role: $("#auth_role").val()
    };

    $.post(GAS_URL, JSON.stringify(payload), function(res) {
        btn.disabled = false; btn.innerText = authMode === 'login' ? "Login" : "Sign Up";
        if(res.status === "success") {
            if(authMode === 'login') {
                localStorage.setItem("bkash_session", JSON.stringify(res.user));
                window.location.reload();
            } else {
                Swal.fire("Success", "Registration successful. Please login.", "success");
                switchAuth('login');
            }
        } else {
            Swal.fire("Error", res.message, "error");
        }
    });
}

function logout() {
    localStorage.removeItem("bkash_session");
    window.location.reload();
}

// ==========================================
// UI / NAVIGATION
// ==========================================
function showPage(page) {
    $(".page").addClass("d-none");
    $(`#page-${page}`).removeClass("d-none");
    
    if(page === 'dashboard' || page === 'reports' || page === 'manage') loadDashboard();
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    document.body.classList.toggle('light-mode');
}

function toggleFields(prefix = "") {
    const type = $(`#${prefix}txn_type`).val();
    $(`.${prefix}f-customer, .${prefix}f-sender, .${prefix}f-receiver, .${prefix}f-bill`).addClass("d-none");

    if(type !== "Personal Expense (ব্যক্তিগত খরচ)") {
        if(type.includes("Cash In") || type.includes("Cash Out")) $(`.${prefix}f-customer`).removeClass("d-none");
        if(type.includes("Send Money") || type.includes("Bank Transfer")) {
            $(`.${prefix}f-sender`).removeClass("d-none");
            $(`.${prefix}f-receiver`).removeClass("d-none");
        }
        if(type.includes("Bill")) {
            $(`.${prefix}f-customer`).removeClass("d-none");
            $(`.${prefix}f-bill`).removeClass("d-none");
        }
    }
}

// ==========================================
// DATA OPERATIONS (ADD, LOAD)
// ==========================================
$("#txnForm").submit(function(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-save-txn");
    btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;

    let payload = { action: "add_transaction", user: currentUser.username };
    const fields = ['txn_type', 'customer_name', 'customer_mobile', 'sender_name', 'sender_mobile', 'receiver_name', 'receiver_mobile', 'bill_account', 'meter_number', 'amount', 'service_charge', 'agent_profit', 'reference', 'remarks'];
    fields.forEach(f => payload[f] = $(`#${f}`).val());

    $.post(GAS_URL, JSON.stringify(payload), function(res) {
        btn.disabled = false; btn.innerHTML = `<i class="fas fa-save"></i> Save Transaction`;
        if(res.status === "success") {
            Swal.fire({
                title: "সফল!",
                text: `${res.message}\nID: ${res.txnId}`,
                icon: "success",
                confirmButtonText: "ঠিক আছে"
            });
            document.getElementById("txnForm").reset();
            toggleFields("");
            calculateCharges("");
        } else {
            Swal.fire("Error", res.message, "error");
        }
    });
});

function loadDashboard() {
    $.post(GAS_URL, JSON.stringify({ action: "get_dashboard" }), function(res) {
        if(res.status === "success") {
            let totalProfit = parseFloat(res.stats.todayProfit || 0);
            let totalExpense = parseFloat(res.stats.todayExpense || 0);
            let finalProfit = totalProfit - totalExpense;

            $("#stat-balance").text(`৳ ${parseFloat(res.stats.currentBalance || 0).toFixed(2)}`);
            $("#stat-txnCount").text(res.stats.todayTotalTxn || 0);
            $("#stat-volume").text(`৳ ${parseFloat(res.stats.todayAmount || 0).toFixed(2)}`);
            $("#stat-profit").text(`৳ ${totalProfit.toFixed(2)}`);
            $("#stat-expense").text(`৳ ${totalExpense.toFixed(2)}`);
            $("#stat-finalProfit").text(`৳ ${finalProfit.toFixed(2)}`);
            
            globalTxns = res.txns; 
            renderReportsTable(res.txns);
            renderManageTable(res.txns);
        }
    });
}

function renderReportsTable(data) {
    if ($.fn.DataTable.isDataTable('#txnTable')) $('#txnTable').DataTable().destroy();
    
    txnTable = $('#txnTable').DataTable({
        data: data,
        columns: [
            { data: 'Date' },
            { data: 'Transaction ID' },
            { data: 'Transaction Type' },
            { data: 'Amount', render: (d) => `৳ ${parseFloat(d).toFixed(2)}` },
            { data: 'Agent Profit', render: (d) => `৳ ${parseFloat(d).toFixed(2)}` },
            { data: 'Balance After', render: (d) => `৳ ${parseFloat(d).toFixed(2)}` },
            { data: 'Status', render: (d) => `<span class="badge bg-success">${d}</span>` }
        ],
        order: [[0, 'desc']],
        pageLength: 15
    });
}

// ==========================================
// MANAGE OPERATIONS (EDIT, DELETE)
// ==========================================
function renderManageTable(data) {
    if ($.fn.DataTable.isDataTable('#manageTable')) $('#manageTable').DataTable().destroy();
    
    manageTable = $('#manageTable').DataTable({
        data: data,
        columns: [
            { 
                data: null, 
                orderable: false,
                render: (d, t, row) => `<input type="checkbox" class="txn-checkbox" value="${row['Transaction ID']}">`
            },
            { data: 'Transaction ID' },
            { data: 'Date' },
            { data: 'Transaction Type' },
            { data: 'Amount', render: (d) => `৳ ${parseFloat(d).toFixed(2)}` },
            { 
                data: null,
                orderable: false,
                render: (d, t, row) => `
                    <button class="btn btn-sm btn-info" onclick="openEditModal('${row['Transaction ID']}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSingle('${row['Transaction ID']}')"><i class="fas fa-trash"></i></button>
                `
            }
        ],
        order: [[1, 'desc']],
        pageLength: 15
    });
}

function toggleSelectAll(source) {
    const checkboxes = document.querySelectorAll('.txn-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
}

function openEditModal(txnId) {
    const txn = globalTxns.find(t => t['Transaction ID'] === txnId);
    if(!txn) return;

    $("#edit_txn_id").val(txn['Transaction ID']);
    $("#edit_txn_type").val(txn['Transaction Type']);
    toggleFields('edit_');
    
    const map = {
        'edit_customer_name': 'Customer Name', 'edit_customer_mobile': 'Customer Mobile',
        'edit_sender_name': 'Sender Name', 'edit_sender_mobile': 'Sender Mobile',
        'edit_receiver_name': 'Receiver Name', 'edit_receiver_mobile': 'Receiver Mobile',
        'edit_bill_account': 'Bill Account', 'edit_meter_number': 'Meter Number',
        'edit_amount': 'Amount', 'edit_service_charge': 'Service Charge',
        'edit_agent_profit': 'Agent Profit', 'edit_reference': 'Reference Number', 'edit_remarks': 'Remarks'
    };

    for(let id in map) $(`#${id}`).val(txn[map[id]]);
    calculateTotalAmount('edit_');
    
    var editModal = new bootstrap.Modal(document.getElementById('editModal'));
    editModal.show();
}

$("#editTxnForm").submit(function(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-update-txn");
    btn.disabled = true; btn.innerHTML = "Updating...";

    let payload = { action: "update_transaction", user: currentUser.username, txn_id: $("#edit_txn_id").val() };
    const fields = ['txn_type', 'customer_name', 'customer_mobile', 'sender_name', 'sender_mobile', 'receiver_name', 'receiver_mobile', 'bill_account', 'meter_number', 'amount', 'service_charge', 'agent_profit', 'reference', 'remarks'];
    fields.forEach(f => payload[f] = $(`#edit_${f}`).val());

    $.post(GAS_URL, JSON.stringify(payload), function(res) {
        btn.disabled = false; btn.innerHTML = "Update Transaction";
        if(res.status === "success") {
            bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
            Swal.fire("Success", res.message, "success");
            loadDashboard();
        } else {
            Swal.fire("Error", res.message, "error");
        }
    });
});

function deleteSingle(txnId) {
    executeDelete([txnId]);
}

function bulkDelete() {
    const selected = Array.from(document.querySelectorAll('.txn-checkbox:checked')).map(cb => cb.value);
    if(selected.length === 0) return Swal.fire("Warning", "কোনো ট্রানজেকশন সিলেক্ট করা হয়নি!", "warning");
    executeDelete(selected);
}

function executeDelete(txnIds) {
    Swal.fire({
        title: 'Are you sure?',
        text: "You won't be able to revert this! Balance will be recalculated.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'Deleting...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            
            $.post(GAS_URL, JSON.stringify({
                action: "delete_transactions",
                user: currentUser.username,
                txn_ids: txnIds
            }), function(res) {
                if(res.status === "success") {
                    Swal.fire("Deleted!", res.message, "success");
                    loadDashboard();
                    document.getElementById('selectAll').checked = false;
                } else {
                    Swal.fire("Error", res.message, "error");
                }
            });
        }
    });
}