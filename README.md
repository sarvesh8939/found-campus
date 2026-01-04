# found-campus
Found@Campus Pinboard is a real-time web platform built to streamline the recovery of lost items and the reporting of found belongings within a college campus. It centralizes campus-wide notifications into a single, interactive feed, replacing traditional physical pinboards with a modern digital solution.


Found@Campus Pinboard
A modern, real-time lost and found solution for college campuses.

🚀 Features
Google Authentication: Secure sign-in restricted to specific college email domains (e.g., psvpec.in).
Real-time Updates: Instant feed updates using Firebase Firestore—no page refresh required.
AI Campus Assistant: A chatbot powered by Gemini 1.5 Flash that understands the context of all posted items to answer user queries.
Smart Image Handling: Client-side image compression and Base64 conversion to optimize storage and performance.
Category Filtering: Easily toggle between "Found" and "Lost" items.
Responsive Design: Fully optimized for mobile, tablet, and desktop views.

🛠️ Tech Stack
Frontend: HTML5, CSS3, JavaScript
Backend-as-a-Service: Firebase (Authentication & Firestore)
Artificial Intelligence: Google Gemini 1.5 Flash API
Icons/Assets: Custom UI elements (eg:logo.png)

📋 Prerequisites
To run this project locally, you will need:
A Firebase Project with Authentication (Google Provider) and Firestore enabled.
A Google AI Studio API Key for the Gemini 1.5 Flash model.

⚙️ Configuration
Open config.js.
Replace the firebaseConfig object with your project credentials from the Firebase Console.
Set your desired email restriction in ALLOWED_EMAIL_DOMAIN (e.g., "yourcollege.edu").
(Internal Note) Ensure your Gemini API key is correctly referenced in app.js within the askChatbot function.

📂 Project Structure
index.html: Main application structure and UI modals.
styles.css: Custom responsive styling and animations.
app.js: Core logic, Firebase integration, and AI Chatbot functionality.
config.js: Environment variables and Firebase configuration.
assets/: Image assets and logos.

🛡️ Security Rules
Ensure your Firestore rules allow read/write access to authenticated users from your specific domain to keep the pinboard safe and relevant to your campus.
