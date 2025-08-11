class BankITMeeting {
    constructor() {
        this.teamMembers = {};
        this.selectedMembers = new Set();
        this.isLoading = false;
        this.conversationHistory = [];
        
        this.initializeComponents();
        this.loadTeamMembers();
        this.setupEventListeners();
    }

    initializeComponents() {
        this.teamList = document.getElementById('team-list');
        this.conversation = document.getElementById('conversation');
        this.userInput = document.getElementById('user-input');
        this.sendBtn = document.getElementById('send-btn');
        this.selectAllCheckbox = document.getElementById('select-all');
        this.participantCount = document.getElementById('participant-count');
        this.memoryPanel = document.getElementById('memory-panel');
    }

    setupEventListeners() {
        // Send message
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Select all functionality
        this.selectAllCheckbox.addEventListener('change', (e) => {
            this.toggleSelectAll(e.target.checked);
        });

        // Close memory panel
        document.getElementById('close-memory').addEventListener('click', () => {
            this.memoryPanel.style.display = 'none';
        });

        // Close memory panel on background click
        this.memoryPanel.addEventListener('click', (e) => {
            if (e.target === this.memoryPanel) {
                this.memoryPanel.style.display = 'none';
            }
        });
    }

    async loadTeamMembers() {
        try {
            const response = await fetch('/api/team-members');
            this.teamMembers = await response.json();
            this.renderTeamMembers();
            this.updateParticipantCount();
        } catch (error) {
            console.error('Error loading team members:', error);
            this.showError('Failed to load team members');
        }
    }

    renderTeamMembers() {
        this.teamList.innerHTML = '';
        
        Object.values(this.teamMembers).forEach(member => {
            const memberElement = this.createMemberElement(member);
            this.teamList.appendChild(memberElement);
        });

        // Initially select all members
        this.toggleSelectAll(true);
    }

    createMemberElement(member) {
        const div = document.createElement('div');
        div.className = 'team-member';
        
        div.innerHTML = `
            <input type="checkbox" id="member-${member.name.replace(/\s+/g, '')}" 
                   value="${member.name}" checked>
            <div class="member-info">
                <div class="member-name">${member.name}</div>
                <div class="member-role">${member.role}</div>
                <div class="member-expertise">${member.expertise}</div>
                <button class="view-memory" onclick="window.bankMeeting.viewMemberMemory('${member.name}')">
                    View Memory
                </button>
            </div>
        `;

        const checkbox = div.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.selectedMembers.add(member.name);
            } else {
                this.selectedMembers.delete(member.name);
            }
            this.updateParticipantCount();
            this.updateSelectAllState();
        });

        // Add to selected members initially
        this.selectedMembers.add(member.name);

        return div;
    }

    toggleSelectAll(checked) {
        const checkboxes = this.teamList.querySelectorAll('input[type="checkbox"]');
        this.selectedMembers.clear();
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
            if (checked) {
                this.selectedMembers.add(checkbox.value);
            }
        });
        
        this.updateParticipantCount();
    }

    updateSelectAllState() {
        const totalMembers = Object.keys(this.teamMembers).length;
        const selectedCount = this.selectedMembers.size;
        
        this.selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalMembers;
        this.selectAllCheckbox.checked = selectedCount === totalMembers;
    }

    updateParticipantCount() {
        this.participantCount.textContent = `Participants: ${this.selectedMembers.size}`;
    }

    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message || this.isLoading) return;

        if (this.selectedMembers.size === 0) {
            this.showError('Please select at least one team member to discuss with.');
            return;
        }

        this.isLoading = true;
        this.sendBtn.disabled = true;
        this.sendBtn.innerHTML = '<span>Sending...</span>';
