// script.js - Fixed version with proper API structure
const API_BASE = 'https://jsonbinbro.onrender.com/api';
const BIN_ID = '6a198bf1966f596be2a747e2';

// User credentials
const USER_ID = 'george01';
const API_KEY = 'XcymJbykd573XqKLEHsZvSBo3hYMDv7uRo5P3PKRYDI';

// DOM elements
const form = document.getElementById('classmate-form');
const firstNameInput = document.getElementById('first-name');
const lastNameInput = document.getElementById('last-name');
const professionInput = document.getElementById('profession');
const telephoneInput = document.getElementById('telephone');
const ageInput = document.getElementById('age');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const tableBody = document.getElementById('table-body');
const searchInput = document.getElementById('search-input');
const refreshBtn = document.getElementById('refresh-btn');
const recordCountSpan = document.getElementById('record-count');
const formTitle = document.getElementById('form-title');
const userIdDisplay = document.getElementById('userIdDisplay');
const logoutBtn = document.getElementById('logoutBtn');

let currentEditIndex = null;
let allClassmates = [];

// Display user info
userIdDisplay.textContent = USER_ID;
logoutBtn.style.display = 'inline-flex';

// Logout function
logoutBtn.addEventListener('click', () => {
    localStorage.clear();
    location.reload();
});

// Helper: Fetch data from JSONBinBro
async function fetchClassmates() {
    try {
        const response = await fetch(`${API_BASE}/bins/${BIN_ID}?api_key=${API_KEY}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Extract classmates from the response structure
        let classmates = [];
        if (result.data && result.data.allusers) {
            classmates = result.data.allusers;
        } else if (result.data && Array.isArray(result.data)) {
            classmates = result.data;
        } else if (result.allusers) {
            classmates = result.allusers;
        }
        
        allClassmates = Array.isArray(classmates) ? classmates : [];
        
        renderTable();
        updateRecordCount();
        return allClassmates;
    } catch (error) {
        console.error('Fetch error:', error);
        tableBody.innerHTML = `<tr><td colspan="6" class="empty-message">⚠️ Failed to load data. Error: ${error.message}<br>Please check your connection.</td></tr>`;
        return [];
    }
}

// Helper: Update entire BIN on server
async function updateBin(dataArray) {
    try {
        // CRITICAL FIX: The backend expects the data wrapped in a 'data' object
        // Based on the BinCreate model in main.py
        const payload = {
            data: { allusers: dataArray },
            name: "My Classmates",
            is_private: false
        };
        
        console.log('Sending payload:', payload); // For debugging
        
        const response = await fetch(`${API_BASE}/bins/${BIN_ID}?api_key=${API_KEY}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Update failed: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Update response:', result); // For debugging
        
        // Update local data from the response
        if (result.data && result.data.allusers) {
            allClassmates = result.data.allusers;
        } else if (result.data && Array.isArray(result.data)) {
            allClassmates = result.data;
        } else {
            allClassmates = dataArray;
        }
        
        renderTable();
        updateRecordCount();
        resetForm();
        
        // Show success message
        showMessage('Data saved successfully!', 'success');
        
        return true;
    } catch (error) {
        console.error('Update error:', error);
        showMessage(`Error saving data: ${error.message}`, 'error');
        return false;
    }
}

// Show temporary message
function showMessage(message, type) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `${type}-message`;
    msgDiv.textContent = message;
    msgDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#28a745' : '#dc3545'};
        color: white;
        padding: 12px 20px;
        border-radius: 5px;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    `;
    document.body.appendChild(msgDiv);
    setTimeout(() => msgDiv.remove(), 3000);
}

// Render table based on search filter
function renderTable() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    let filteredClassmates = [...allClassmates];
    
    if (searchTerm) {
        filteredClassmates = allClassmates.filter(person => 
            (person.fname?.toLowerCase() || '').includes(searchTerm) ||
            (person.lname?.toLowerCase() || '').includes(searchTerm) ||
            (person.profession?.toLowerCase() || '').includes(searchTerm) ||
            (person.telephone || '').includes(searchTerm)
        );
    }
    
    if (filteredClassmates.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="empty-message">👥 No classmates found. Add one above!</td></tr>`;
        return;
    }
    
    let html = '';
    filteredClassmates.forEach((person, idx) => {
        // Find the actual index in allClassmates for edit/delete operations
        const actualIndex = allClassmates.findIndex(p => 
            p.fname === person.fname && 
            p.lname === person.lname && 
            p.telephone === person.telephone
        );
        
        const indexToUse = actualIndex !== -1 ? actualIndex : idx;
        
        html += `
            <tr>
                <td>${escapeHtml(person.fname || '')}</td>
                <td>${escapeHtml(person.lname || '')}</td>
                <td>${escapeHtml(person.profession || '')}</td>
                <td>${escapeHtml(person.telephone || '')}</td>
                <td>${person.age || ''}</td>
                <td class="action-cell">
                    <button class="edit-btn" data-index="${indexToUse}">✏️ Edit</button>
                    <button class="delete-btn" data-index="${indexToUse}">🗑️ Delete</button>
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;
    
    // Attach event listeners to edit/delete buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.getAttribute('data-index'));
            if (!isNaN(idx)) editClassmate(idx);
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const idx = parseInt(btn.getAttribute('data-index'));
            if (!isNaN(idx) && confirm('Delete this classmate permanently?')) {
                await deleteClassmate(idx);
            }
        });
    });
}

// Escape HTML to prevent injection
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function updateRecordCount() {
    const total = allClassmates.length;
    recordCountSpan.textContent = `📋 Total: ${total} classmate${total !== 1 ? 's' : ''}`;
}

// Reset form after save/cancel
function resetForm() {
    form.reset();
    currentEditIndex = null;
    formTitle.textContent = 'Add New Classmate';
    saveBtn.textContent = '💾 Save Classmate';
    cancelBtn.style.display = 'inline-flex';
    if (firstNameInput) firstNameInput.focus();
}

// Fill form for editing
function editClassmate(index) {
    if (index < 0 || index >= allClassmates.length) return;
    
    const classmate = allClassmates[index];
    firstNameInput.value = classmate.fname || '';
    lastNameInput.value = classmate.lname || '';
    professionInput.value = classmate.profession || '';
    telephoneInput.value = classmate.telephone || '';
    ageInput.value = classmate.age || '';
    
    currentEditIndex = index;
    formTitle.textContent = '✏️ Edit Classmate';
    saveBtn.textContent = '🔄 Update Classmate';
    cancelBtn.style.display = 'inline-flex';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Delete classmate
async function deleteClassmate(index) {
    if (index < 0 || index >= allClassmates.length) return;
    
    const newClassmates = [...allClassmates];
    newClassmates.splice(index, 1);
    const success = await updateBin(newClassmates);
    
    if (success && currentEditIndex !== null) {
        if (currentEditIndex === index || index < currentEditIndex) {
            resetForm();
        } else if (currentEditIndex > index) {
            currentEditIndex--;
        }
    }
}

// Save or update classmate
async function saveClassmate(event) {
    event.preventDefault();
    
    // Validation
    const fname = firstNameInput.value.trim();
    const lname = lastNameInput.value.trim();
    const profession = professionInput.value.trim();
    const telephone = telephoneInput.value.trim();
    const age = parseInt(ageInput.value);
    
    if (!fname || !lname || !profession || !telephone) {
        alert('Please fill all fields: First Name, Last Name, Profession, and Telephone.');
        return;
    }
    
    if (isNaN(age) || age < 1 || age > 120) {
        alert('Please enter a valid age between 1 and 120.');
        return;
    }
    
    const newClassmate = {
        fname: fname,
        lname: lname,
        profession: profession,
        telephone: telephone,
        age: age
    };
    
    let updatedList;
    if (currentEditIndex !== null) {
        // Update existing
        updatedList = [...allClassmates];
        updatedList[currentEditIndex] = newClassmate;
        showMessage('Updating existing record...', 'success');
    } else {
        // Add new - append to existing list
        updatedList = [...allClassmates, newClassmate];
        showMessage('Adding new record...', 'success');
    }
    
    const success = await updateBin(updatedList);
    if (success) {
        resetForm();
    }
}

// Cancel editing
function cancelEdit() {
    resetForm();
}

// Refresh data from server
async function refreshData() {
    tableBody.innerHTML = `<tr><td colspan="6" class="loading-message">🔄 Refreshing...</td></tr>`;
    await fetchClassmates();
    showMessage('Data refreshed!', 'success');
}

// Add animation keyframes to document
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// Event listeners
form.addEventListener('submit', saveClassmate);
cancelBtn.addEventListener('click', cancelEdit);
refreshBtn.addEventListener('click', refreshData);
searchInput.addEventListener('input', () => renderTable());

// Initial load
fetchClassmates();
