import asyncio
import json
import threading
import time
from datetime import datetime
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from groq import Groq
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class TeamMember:
    name: str
    role: str
    personality: str
    expertise: str
    memory: List[str]
    conversation_history: List[Dict]
    
    def add_to_memory(self, item: str):
        self.memory.append(f"[{datetime.now().strftime('%H:%M:%S')}] {item}")
        if len(self.memory) > 50:  # Keep last 50 memories
            self.memory = self.memory[-50:]
    
    def get_context(self) -> str:
        recent_memory = self.memory[-10:] if self.memory else []
        return f"""
        Role: {self.role}
        Expertise: {self.expertise}
        Personality: {self.personality}
        Recent Memory: {' | '.join(recent_memory)}
        """

class BankITDepartment:
    def __init__(self, groq_api_key: str):
        self.client = Groq(api_key=groq_api_key)
        self.team_members = self._create_team()
        self.conversation_log = []
        self.meeting_notes = []
        
    def _create_team(self) -> Dict[str, TeamMember]:
        """Create 20 IT team members plus supervisor with unique personalities"""
        members = {}
        
        # Supervisor
        members["Sarah Mitchell"] = TeamMember(
            name="Sarah Mitchell",
            role="IT Supervisor",
            personality="Strategic, patient, decisive leader who focuses on big picture and resource allocation",
            expertise="Team management, strategic planning, budget oversight, cross-departmental coordination",
            memory=[],
            conversation_history=[]
        )
        
        # Team members with diverse roles and personalities
        team_data = [
            ("Alex Chen", "Senior Systems Administrator", "Detail-oriented perfectionist who loves solving complex problems", "Linux/Windows servers, network infrastructure, automation scripting"),
            ("Maria Rodriguez", "Database Administrator", "Analytical thinker who speaks in data and metrics", "SQL Server, Oracle, PostgreSQL, data optimization, backup strategies"),
            ("James Wilson", "Network Security Specialist", "Paranoid but thorough, always thinks about security implications", "Firewall management, penetration testing, security protocols, threat analysis"),
            ("Emily Davis", "Full Stack Developer", "Creative problem solver who thinks in code", "Python, JavaScript, API development, web applications"),
            ("Michael Brown", "DevOps Engineer", "Efficiency-focused automation enthusiast", "CI/CD pipelines, Docker, Kubernetes, cloud infrastructure"),
            ("Lisa Zhang", "Business Analyst", "Bridge between technical and business, asks lots of questions", "Process analysis, requirements gathering, documentation, stakeholder management"),
            ("David Johnson", "Cloud Architect", "Forward-thinking strategist obsessed with scalability", "AWS, Azure, cloud migration, architecture design"),
            ("Rachel Green", "QA Tester", "Skeptical by nature, finds problems others miss", "Test automation, bug tracking, quality assurance, user acceptance testing"),
            ("Kevin Lee", "Mobile App Developer", "User experience focused, thinks mobile-first", "iOS, Android, React Native, mobile UX/UI"),
            ("Sophie Anderson", "Data Scientist", "Pattern recognition expert who loves insights", "Machine learning, data analysis, Python, R, statistical modeling"),
            ("Tom Miller", "Help Desk Manager", "People-person who understands user pain points", "User support, ticket management, training, customer service"),
            ("Nina Patel", "IT Compliance Officer", "Risk-averse, process-oriented, regulation-focused", "GDPR, SOX compliance, audit preparation, policy development"),
            ("Chris Taylor", "Backup & Recovery Specialist", "Disaster-focused pessimist who prepares for worst-case scenarios", "Data backup, disaster recovery, business continuity planning"),
            ("Amanda White", "ERP Systems Administrator", "Integration specialist who sees connections everywhere", "SAP, Oracle ERP, system integration, workflow optimization"),
            ("Robert Kim", "Cybersecurity Analyst", "Threat-hunting detective with forensic mindset", "SIEM tools, incident response, malware analysis, digital forensics"),
            ("Jessica Liu", "Project Manager", "Timeline-obsessed organizer who keeps everyone on track", "Agile methodology, resource planning, stakeholder communication"),
            ("Daniel Garcia", "API Developer", "Integration enthusiast who connects systems", "REST APIs, microservices, system integration, documentation"),
            ("Lauren Scott", "UX/UI Designer", "User-centric designer who thinks about adoption", "User interface design, usability testing, design systems"),
            ("Mark Thompson", "Infrastructure Engineer", "Hardware-focused problem solver", "Server hardware, virtualization, capacity planning, performance tuning"),
            ("Priya Sharma", "Automation Specialist", "Efficiency expert who automates repetitive tasks", "RPA tools, workflow automation, process optimization, scripting")
        ]
        
        for name, role, personality, expertise in team_data:
            members[name] = TeamMember(
                name=name,
                role=role,
                personality=personality,
                expertise=expertise,
                memory=[],
                conversation_history=[]
            )
        
        return members
    
    async def generate_response(self, member_name: str, user_message: str, context: str) -> str:
        """Generate response from specific team member using Groq API"""
        member = self.team_members[member_name]
        
        system_prompt = f"""You are {member.name}, {member.role} in a bank's IT department.

{member.get_context()}

You are in a meeting to learn about a user's department processes so your IT team can help automate their tasks. 

Guidelines:
- Stay in character based on your role and personality
- Ask specific technical questions related to your expertise
- Suggest automation solutions that fit your specialty
- Reference your previous memories when relevant
- Be collaborative but maintain your unique perspective
- Keep responses concise (2-3 sentences max)
- Focus on understanding the user's processes to identify automation opportunities

Current conversation context:
{context}

Respond as {member.name} would, considering your role and personality."""

        try:
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                model="llama-3.1-8b-instant",
                temperature=0.7,
                max_tokens=200
            )
            
            response = chat_completion.choices[0].message.content
            
            # Add to member's memory and conversation history
            member.add_to_memory(f"User said: {user_message[:100]}...")
            member.add_to_memory(f"I responded: {response[:100]}...")
            member.conversation_history.append({
                "timestamp": datetime.now().isoformat(),
                "user_message": user_message,
                "response": response
            })
            
            return response
            
        except Exception as e:
            logger.error(f"Error generating response for {member_name}: {e}")
            return f"I'm having trouble processing that right now. Could you repeat the question?"
    
    async def facilitate_discussion(self, user_message: str, selected_members: List[str] = None) -> Dict:
        """Facilitate discussion with selected team members"""
        if not selected_members:
            # Select random 3-5 members plus supervisor for manageable conversation
            import random
            available_members = list(self.team_members.keys())
            available_members.remove("Sarah Mitchell")  # Always include supervisor separately
            selected_members = ["Sarah Mitchell"] + random.sample(available_members, min(4, len(available_members)))
        
        # Build conversation context
        recent_log = self.conversation_log[-10:] if self.conversation_log else []
        context = "Recent conversation:\n" + "\n".join([f"{entry['speaker']}: {entry['message']}" for entry in recent_log])
        
        # Generate responses concurrently
        tasks = []
        for member_name in selected_members:
            task = self.generate_response(member_name, user_message, context)
            tasks.append((member_name, task))
        
        responses = {}
        for member_name, task in tasks:
            try:
                response = await task
                responses[member_name] = response
            except Exception as e:
                logger.error(f"Error getting response from {member_name}: {e}")
                responses[member_name] = "I need a moment to process that."
        
        # Log the conversation
        self.conversation_log.append({
            "timestamp": datetime.now().isoformat(),
            "speaker": "User",
            "message": user_message
        })
        
        for member_name, response in responses.items():
            self.conversation_log.append({
                "timestamp": datetime.now().isoformat(),
                "speaker": member_name,
                "message": response
            })
        
        return {
            "responses": responses,
            "participants": selected_members,
            "conversation_id": len(self.conversation_log)
        }

# Flask application
app = Flask(__name__)
CORS(app)

# Initialize the IT department
GROQ_API_KEY = "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"
it_department = BankITDepartment(GROQ_API_KEY)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/team-members', methods=['GET'])
def get_team_members():
    """Get list of all team members"""
    members_info = {}
    for name, member in it_department.team_members.items():
        members_info[name] = {
            "name": member.name,
            "role": member.role,
            "personality": member.personality,
            "expertise": member.expertise
        }
    return jsonify(members_info)

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle chat message"""
    data = request.json
    user_message = data.get('message', '')
    selected_members = data.get('selected_members', [])
    
    if not user_message:
        return jsonify({"error": "Message is required"}), 400
    
    # Run async function in event loop
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        result = loop.run_until_complete(
            it_department.facilitate_discussion(user_message, selected_members)
        )
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error in chat: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        loop.close()

@app.route('/api/conversation-log', methods=['GET'])
def get_conversation_log():
    """Get conversation history"""
    return jsonify(it_department.conversation_log)

@app.route('/api/member-memory/<member_name>', methods=['GET'])
def get_member_memory(member_name):
    """Get specific member's memory"""
    if member_name in it_department.team_members:
        member = it_department.team_members[member_name]
        return jsonify({
            "name": member.name,
            "memory": member.memory,
            "conversation_history": member.conversation_history
        })
    return jsonify({"error": "Member not found"}), 404

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
