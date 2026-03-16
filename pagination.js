// pagination.js - Pagination Utility

class Pagination {
    constructor(containerId, itemsPerPage = 10) {
        this.container = document.getElementById(containerId);
        this.itemsPerPage = itemsPerPage;
        this.currentPage = 1;
        this.data = [];
        this.filteredData = [];
        this.onPageChange = null;
        this.instanceId = containerId; // Store instance ID for reference
    }

    setData(data) {
        this.data = data;
        this.filteredData = data;
        this.currentPage = 1;
        this.render();
    }

    filter(filterFn) {
        this.filteredData = this.data.filter(filterFn);
        this.currentPage = 1;
        this.render();
    }

    getCurrentPageData() {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        return this.filteredData.slice(start, end);
    }

    getTotalPages() {
        return Math.ceil(this.filteredData.length / this.itemsPerPage);
    }

    nextPage() {
        if (this.currentPage < this.getTotalPages()) {
            this.currentPage++;
            this.render();
        }
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.render();
        }
    }

    goToPage(page) {
        if (page >= 1 && page <= this.getTotalPages()) {
            this.currentPage = page;
            this.render();
        }
    }

    renderPaginationControls() {
        const totalPages = this.getTotalPages();
        if (totalPages <= 1) return '';

        // Create unique function names for this instance
        const nextFn = `window.paginationInstances['${this.instanceId}'].nextPage()`;
        const prevFn = `window.paginationInstances['${this.instanceId}'].prevPage()`;
        const goToFn = `window.paginationInstances['${this.instanceId}'].goToPage`;

        let controls = `
            <div class="pagination-controls">
                <button class="pagination-btn" onclick="${prevFn}" ${this.currentPage === 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
                <span class="pagination-info">
                    Page ${this.currentPage} of ${totalPages} 
                    (${this.filteredData.length} total records)
                </span>
                <button class="pagination-btn" onclick="${nextFn}" ${this.currentPage === totalPages ? 'disabled' : ''}>
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;

        // Add page numbers for better navigation
        if (totalPages > 1) {
            let pageNumbers = '<div class="pagination-pages">';
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                    pageNumbers += `
                        <button class="pagination-page ${i === this.currentPage ? 'active' : ''}" 
                                onclick="${goToFn}(${i})">
                            ${i}
                        </button>
                    `;
                } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                    pageNumbers += '<span class="pagination-ellipsis">...</span>';
                }
            }
            pageNumbers += '</div>';
            controls = pageNumbers + controls;
        }

        return controls;
    }

    render() {
        if (!this.container) return;
        
        const currentPageData = this.getCurrentPageData();
        if (this.onPageChange) {
            this.onPageChange(currentPageData);
        }
        
        // Update or create pagination controls
        let paginationDiv = document.getElementById(`${this.container.id}-pagination`);
        if (!paginationDiv) {
            paginationDiv = document.createElement('div');
            paginationDiv.id = `${this.container.id}-pagination`;
            paginationDiv.className = 'pagination-wrapper';
            this.container.parentNode.insertBefore(paginationDiv, this.container.nextSibling);
        }
        
        paginationDiv.innerHTML = this.renderPaginationControls();
    }
}

// Create a global object to store pagination instances
window.paginationInstances = {};

// Make Pagination class globally available
window.Pagination = Pagination;
