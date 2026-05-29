// script.js
const API_BASE = 'https://jsonbinbro.onrender.com/api/bins/6a198bf1966f596be2a747e2';
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

let currentEditIndex = null; // Stores index of classmate being edited
let allClassmates = [];       // Stores the current array of classmates

// Helper: Fetch data from JSONBinBro
async function fetchClassmates() {
    try {
        const response = await fetch(`${API_BASE}?api_key=${API_KEY}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        // Structure: { data: { allusers: [...] } }
        const classmates = result.data?.allusers || [];
        allClassmates = Array.isArray(classmates) ? classmates : [];
        renderTable();
        updateRecordCount();
        return allClassmates;
    } catch (error) {
        console.error('Fetch error:', error);
        tableBody.innerHTML = `<tr><td colspan="6" class="empty-message">⚠️ Failed to load data. Check network or API key.</td></tr>`;
        return [];
    }
}

// Helper: Update entire BIN on server
async function updateBin(dataArray) {
    try {
        const payload = { allusers: dataArray };
        const response = await fetch(`${API_BASE}?api_key=${API_KEY}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`Update failed: ${response.status}`);
        const result = await response.json();
        allClassmates = result.data?.allusers || dataArray;
        renderTable();
        updateRecordCount();
        resetForm();
        return true;
    } catch (error) {
        console.error('Update error:', error);
        alert('Error saving data to server. Please try again.');
        return false;
    }
}

// Render table based on search filter
function renderTable() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    let filteredClassmates = [...allClassmates];
    
    if (searchTerm) {
        filteredClassmates = allClassmates.filter(person => 
            person.fname?.toLowerCase().includes(searchTerm) ||
            person.lname?.toLowerCase().includes(searchTerm) ||
            person.profession?.toLowerCase().includes(searchTerm) ||
            person.telephone?.includes(searchTerm)
        );
    }
    
    if (filteredClassmates.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="empty-message">👥 No classmates found. Add one above!</td></tr>`;
        return;
    }
    
    let html = '';
    filteredClassmates.forEach((person, idx) => {
        // Find original index for editing/deleting
        const originalIndex = allClassmates.findIndex((p, i) => 
            p.fname === person.fname && 
            p.lname === person.lname && 
            p.telephone === person.telephone
        );
        const actualIdx = originalIndex !== -1 ? originalIndex : idx;
        
        html += `
            <tr>
                <td>${escapeHtml(person.fname || '')}</td>
                <td>${escapeHtml(person.lname || '')}</td>
                <td>${escapeHtml(person.profession || '')}</td>
                <td>${escapeHtml(person.telephone || '')}</td>
                <td>${person.age || ''}</td>
                <td class="action-cell">
                    <button class="edit-btn" data-index="${actualIdx}">✏️ Edit</button>
                    <button class="delete-btn" data-index="${actualIdx}">🗑️ Delete</button>
                </td>
            </tr>
        `;
    });
    tableBody.innerHTML = html;
    
    // Attach event listeners to edit/delete buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.getAttribute('data-index'));
            editClassmate(idx);
        });
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const idx = parseInt(btn.getAttribute('data-index'));
            if (confirm('Delete this classmate permanently?')) {
                await deleteClassmate(idx);
            }
        });
    });
}

// Escape HTML to prevent injection
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
        return c;
    });
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
    // Clear validation styles
    firstNameInput.focus();
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
        // If we were editing a deleted one, cancel edit mode
        if (currentEditIndex === index || index < currentEditIndex) {
            resetForm();
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
    
    if (!fname || !lname || !profession || !telephone || isNaN(age) || age < 1 || age > 120) {
        alert('Please fill all fields correctly: First Name, Last Name, Profession, Telephone, and Age (1-120).');
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
    } else {
        // Add new
        updatedList = [...allClassmates, newClassmate];
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
}

// Event listeners
form.addEventListener('submit', saveClassmate);
cancelBtn.addEventListener('click', cancelEdit);
refreshBtn.addEventListener('click', refreshData);
searchInput.addEventListener('input', () => renderTable());

// Initial load
fetchClassmates();
