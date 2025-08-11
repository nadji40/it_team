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
        // Add user message to conversation
       this.addMessageToConversation('You', message, 'user-message');
       this.userInput.value = '';

       // Show typing indicator
       this.showTypingIndicator();

       try {
           const response = await fetch('/api/chat', {
               method: 'POST',
               headers: {
                   'Content-Type': 'application/json',
               },
               body: JSON.stringify({
                   message: message,
                   selected_members: Array.from(this.selectedMembers)
               })
           });

           if (!response.ok) {
               throw new Error(`HTTP error! status: ${response.status}`);
           }

           const data = await response.json();
           
           // Remove typing indicator
           this.removeTypingIndicator();
           
           // Add IT team responses
           this.addITResponses(data.responses);
           
       } catch (error) {
           console.error('Error sending message:', error);
           this.removeTypingIndicator();
           this.showError('Failed to get response from IT team. Please try again.');
       } finally {
           this.isLoading = false;
           this.sendBtn.disabled = false;
           this.sendBtn.innerHTML = '<span>Send to IT Team</span>';
       }
   }

   addMessageToConversation(sender, message, className) {
       const messageDiv = document.createElement('div');
       messageDiv.className = `message ${className}`;
       
       const timestamp = new Date().toLocaleTimeString();
       messageDiv.innerHTML = `
           <div class="message-header">
               <span><strong>${sender}</strong></span>
               <span class="message-time">${timestamp}</span>
           </div>
           <div class="message-content">${this.formatMessage(message)}</div>
       `;
       
       this.conversation.appendChild(messageDiv);
       this.scrollToBottom();
   }

   addITResponses(responses) {
       // Group responses by role for better organization
       const supervisor = responses['Sarah Mitchell'];
       delete responses['Sarah Mitchell'];
       
       // Add supervisor response first if present
       if (supervisor) {
           this.addMessageToConversation('Sarah Mitchell (IT Supervisor)', supervisor, 'it-response');
       }
       
       // Add other team member responses
       Object.entries(responses).forEach(([member, response]) => {
           const memberInfo = this.teamMembers[member];
           const displayName = `${member} (${memberInfo.role})`;
           this.addMessageToConversation(displayName, response, 'it-response');
       });
   }

   showTypingIndicator() {
       const typingDiv = document.createElement('div');
       typingDiv.className = 'typing-indicator';
       typingDiv.id = 'typing-indicator';
       typingDiv.innerHTML = `
           <span>IT Team is thinking</span>
           <div class="typing-dots">
               <span></span>
               <span></span>
               <span></span>
           </div>
       `;
       this.conversation.appendChild(typingDiv);
       this.scrollToBottom();
   }

   removeTypingIndicator() {
       const typingIndicator = document.getElementById('typing-indicator');
       if (typingIndicator) {
           typingIndicator.remove();
       }
   }

   formatMessage(message) {
       // Basic formatting for better readability
       return message
           .replace(/\n/g, '<br>')
           .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
           .replace(/\*(.*?)\*/g, '<em>$1</em>')
           .replace(/`(.*?)`/g, '<code>$1</code>');
   }

   scrollToBottom() {
       this.conversation.scrollTop = this.conversation.scrollHeight;
   }

   async viewMemberMemory(memberName) {
       try {
           const response = await fetch(`/api/member-memory/${encodeURIComponent(memberName)}`);
           const data = await response.json();
           
           if (response.ok) {
               this.showMemoryPanel(data);
           } else {
               this.showError(data.error || 'Failed to load member memory');
           }
       } catch (error) {
           console.error('Error loading member memory:', error);
           this.showError('Failed to load member memory');
       }
   }

   showMemoryPanel(memberData) {
       const memoryTitle = document.getElementById('memory-title');
       const memoryContent = document.getElementById('memory-content');
       
       memoryTitle.textContent = `${memberData.name}'s Memory & Context`;
       
       let memoryHTML = '';
       
       if (memberData.memory && memberData.memory.length > 0) {
           memoryHTML += '<h5>Recent Memory:</h5>';
           memberData.memory.slice(-10).forEach(item => {
               memoryHTML += `<div class="memory-item">${item}</div>`;
           });
       } else {
           memoryHTML += '<p>No memory items yet.</p>';
       }
       
       if (memberData.conversation_history && memberData.conversation_history.length > 0) {
           memoryHTML += '<h5 style="margin-top: 20px;">Conversation History:</h5>';
           memberData.conversation_history.slice(-5).forEach(conv => {
               const timestamp = new Date(conv.timestamp).toLocaleTimeString();
               memoryHTML += `
                   <div class="memory-item">
                       <strong>${timestamp}</strong><br>
                       <em>User:</em> ${conv.user_message.substring(0, 100)}${conv.user_message.length > 100 ? '...' : ''}<br>
                       <em>Response:</em> ${conv.response.substring(0, 100)}${conv.response.length > 100 ? '...' : ''}
                   </div>
               `;
           });
       }
       
       memoryContent.innerHTML = memoryHTML;
       this.memoryPanel.style.display = 'block';
   }

   showError(message) {
       const errorDiv = document.createElement('div');
       errorDiv.className = 'message system-message';
       errorDiv.style.background = '#f8d7da';
       errorDiv.style.borderColor = '#f5c6cb';
       errorDiv.style.color = '#721c24';
       errorDiv.innerHTML = `<strong>Error:</strong> ${message}`;
       
       this.conversation.appendChild(errorDiv);
       this.scrollToBottom();
       
       // Auto-remove error after 5 seconds
       setTimeout(() => {
           if (errorDiv.parentNode) {
               errorDiv.remove();
           }
       }, 5000);
   }

   // Utility method to get conversation summary
   getConversationSummary() {
       return {
           totalMessages: this.conversationHistory.length,
           participants: Array.from(this.selectedMembers),
           timestamp: new Date().toISOString()
       };
   }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
   window.bankMeeting = new BankITMeeting();
});

// Add some helpful utility functions
window.addEventListener('beforeunload', (e) => {
   if (window.bankMeeting && window.bankMeeting.conversationHistory.length > 0) {
       e.preventDefault();
       e.returnValue = 'You have an ongoing conversation. Are you sure you want to leave?';
   }
});

// Auto-save conversation to localStorage
setInterval(() => {
   if (window.bankMeeting) {
       const summary = window.bankMeeting.getConversationSummary();
       localStorage.setItem('bankITMeetingState', JSON.stringify(summary));
   }
}, 30000); // Save every 30 seconds
