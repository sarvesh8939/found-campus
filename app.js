// Configuration
const MAX_POSTS = 50;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const MAX_BASE64_SIZE = 700 * 1024;

// Wait for Firebase to be initialized
function initApp() {
  if (!window.firebaseReady || !window.firebaseFunctions) {
    console.log("Waiting for Firebase to initialize...");
    window.addEventListener("firebaseReady", initApp);
    return;
  }

  const {
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    limit,
    getDocs,
    deleteDoc,
    doc,
  } = window.firebaseFunctions;

  const auth = window.firebaseAuth;
  const db = window.firebaseDb;
  const provider = window.firebaseProvider;

  // DOM Elements
  const signInBtn = document.getElementById("sign-in-btn");
  const signOutBtn = document.getElementById("sign-out-btn");
  const loginSection = document.getElementById("login-section");
  const mainContent = document.getElementById("main-content");
  const userInfo = document.getElementById("user-info");
  const authError = document.getElementById("auth-error");
  const foundItemForm = document.getElementById("found-item-form");
  const itemsList = document.getElementById("items-list");
  const loading = document.getElementById("loading");
  const emptyState = document.getElementById("empty-state");
  const noResults = document.getElementById("no-results");
  const searchInput = document.getElementById("search-input");
  const toggleFormBtn = document.getElementById("toggle-form-btn");
  const postSection = document.getElementById("post-section");
  const cancelFormBtn = document.getElementById("cancel-form-btn");
  const itemImageInput = document.getElementById("item-image");
  const imagePreview = document.getElementById("image-preview");
  const previewImg = document.getElementById("preview-img");
  const removeImageBtn = document.getElementById("remove-image");
  const locationLabel = document.getElementById("location-label");

  // Store all items for search filtering
  let allItems = [];
  let searchTerm = "";
  let currentCategory = "all"; // "all", "found", or "lost"

  // Update location label based on item type
  const itemTypeRadios = document.querySelectorAll('input[name="itemType"]');
  itemTypeRadios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      if (e.target.value === "found") {
        locationLabel.textContent = "Location Found *";
        document.getElementById("location-found").placeholder =
          "e.g., Library 2nd floor, Cafeteria, Building A";
      } else {
        locationLabel.textContent = "Location Lost *";
        document.getElementById("location-found").placeholder =
          "e.g., Near cafeteria, Parking lot, Classroom 301";
      }
    });
  });

  // Category tabs handling
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentCategory = btn.dataset.category;
      filterAndDisplayItems();
    });
  });

  // Validate email domain
  function isValidEmailDomain(email) {
    if (!ALLOWED_EMAIL_DOMAIN) {
      return true;
    }

    if (ALLOWED_EMAIL_DOMAIN.startsWith(".")) {
      return email.endsWith(ALLOWED_EMAIL_DOMAIN);
    } else {
      return email.endsWith("@" + ALLOWED_EMAIL_DOMAIN);
    }
  }

  // Toggle form visibility
  toggleFormBtn.addEventListener("click", () => {
    const isVisible = postSection.style.display !== "none";
    postSection.style.display = isVisible ? "none" : "block";
    toggleFormBtn.innerHTML = isVisible
      ? '<span class="btn-icon">➕</span> Post New Item'
      : '<span class="btn-icon">✕</span> Cancel';

    if (!isVisible) {
      postSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  cancelFormBtn.addEventListener("click", () => {
    postSection.style.display = "none";
    foundItemForm.reset();
    imagePreview.style.display = "none";
    toggleFormBtn.innerHTML = '<span class="btn-icon">➕</span> Post New Item';
  });

  // Image preview handling
  itemImageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > MAX_IMAGE_SIZE) {
        alert(
          "Image size must be less than 2MB. Please choose a smaller image."
        );
        itemImageInput.value = "";
        return;
      }

      if (!file.type.startsWith("image/")) {
        alert("Please select an image file.");
        itemImageInput.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        previewImg.src = event.target.result;
        imagePreview.style.display = "block";
      };
      reader.readAsDataURL(file);
    }
  });

  removeImageBtn.addEventListener("click", () => {
    itemImageInput.value = "";
    imagePreview.style.display = "none";
  });

  // Search functionality
  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    filterAndDisplayItems();
  });

  // Sign in with Google
  signInBtn.addEventListener("click", async () => {
    try {
      authError.style.display = "none";
      signInBtn.disabled = true;
      signInBtn.textContent = "Signing in...";

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!isValidEmailDomain(user.email)) {
        await signOut(auth);
        authError.textContent = `Access denied. Only ${
          ALLOWED_EMAIL_DOMAIN || "college"
        } email addresses are allowed.`;
        authError.style.display = "block";
        signInBtn.disabled = false;
        signInBtn.textContent = "Sign in with Google";
        return;
      }
    } catch (error) {
      console.error("Sign-in error:", error);
      signInBtn.disabled = false;
      signInBtn.textContent = "Sign in with Google";

      if (error.code === "auth/popup-closed-by-user") {
        return;
      } else if (error.code === "auth/unauthorized-domain") {
        authError.textContent =
          "This domain is not authorized. Please add your domain in Firebase Console > Authentication > Settings > Authorized domains.";
      } else if (error.code === "auth/operation-not-allowed") {
        authError.textContent =
          "Google sign-in is not enabled. Please enable it in Firebase Console.";
      } else if (error.code === "auth/popup-blocked") {
        authError.textContent =
          "Popup was blocked. Please allow popups for this site.";
      } else if (error.code === "auth/network-request-failed") {
        authError.textContent = "Network error. Please check your connection.";
      } else {
        authError.textContent = `Sign-in failed: ${
          error.message || error.code || "Unknown error"
        }`;
      }
      authError.style.display = "block";
    }
  });

  // Sign out
  signOutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign-out error:", error);
    }
  });

  // Handle authentication state changes
  onAuthStateChanged(auth, (user) => {
    if (user && isValidEmailDomain(user.email)) {
      userInfo.textContent = `Signed in as ${user.displayName || user.email}`;
      loginSection.style.display = "none";
      mainContent.style.display = "block";
      signOutBtn.style.display = "inline-block";
      loadFeed();
    } else {
      userInfo.textContent = "";
      loginSection.style.display = "block";
      mainContent.style.display = "none";
      signOutBtn.style.display = "none";
      itemsList.innerHTML = "";
      allItems = [];
      searchTerm = "";
    }
  });

  // Convert image to base64 and compress
  function compressAndConvertToBase64(imageFile) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const img = new Image();

        img.onload = () => {
          let quality = 0.9;
          let width = img.width;
          let height = img.height;
          const maxDimension = 1200;

          if (width > maxDimension || height > maxDimension) {
            const ratio = Math.min(maxDimension / width, maxDimension / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          const tryCompress = (q) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error("Failed to compress image"));
                  return;
                }

                if (blob.size > MAX_BASE64_SIZE && q > 0.3) {
                  tryCompress(q - 0.1);
                } else {
                  const reader2 = new FileReader();
                  reader2.onload = (e) => {
                    const base64String = e.target.result;

                    if (base64String.length > MAX_BASE64_SIZE) {
                      reject(
                        new Error(
                          "Image too large even after compression. Please use a smaller image."
                        )
                      );
                    } else {
                      resolve(base64String);
                    }
                  };
                  reader2.onerror = () =>
                    reject(new Error("Failed to convert image to base64"));
                  reader2.readAsDataURL(blob);
                }
              },
              "image/jpeg",
              q
            );
          };

          tryCompress(quality);
        };

        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = event.target.result;
      };

      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(imageFile);
    });
  }

  // Auto-delete old posts
  async function checkAndDeleteOldPosts() {
    try {
      const itemsQuery = query(
        collection(db, "foundItems"),
        orderBy("timestamp", "desc")
      );

      const snapshot = await getDocs(itemsQuery);

      if (snapshot.size > MAX_POSTS) {
        const items = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() });
        });

        const itemsToDelete = items.slice(MAX_POSTS);

        for (const item of itemsToDelete) {
          await deleteDoc(doc(db, "foundItems", item.id));
        }

        console.log(`Deleted ${itemsToDelete.length} old post(s)`);
      }
    } catch (error) {
      console.error("Error checking/deleting old posts:", error);
    }
  }

  // Post item
  foundItemForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
      alert("Please sign in to post items.");
      return;
    }

    const formData = new FormData(foundItemForm);
    const itemName = formData.get("itemName").trim();
    const locationFound = formData.get("locationFound").trim();
    const contactInfo = formData.get("contactInfo").trim();
    const itemType = formData.get("itemType"); 
    const imageFile = formData.get("itemImage");

    if (!itemName || !locationFound || !contactInfo) {
      alert("Please fill in all required fields.");
      return;
    }

    try {
      const submitBtn = foundItemForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "Posting...";

      let imageUrl = null;

      if (imageFile && imageFile.size > 0) {
        if (imageFile.size > MAX_IMAGE_SIZE) {
          alert("Image size must be less than 2MB.");
          submitBtn.disabled = false;
          submitBtn.textContent = "Post Item";
          return;
        }

        if (!imageFile.type.startsWith("image/")) {
          alert("Please select an image file.");
          submitBtn.disabled = false;
          submitBtn.textContent = "Post Item";
          return;
        }

        try {
          submitBtn.textContent = "Processing image...";
          imageUrl = await compressAndConvertToBase64(imageFile);
        } catch (processError) {
          console.error("Error processing image:", processError);
          alert(
            `Failed to process image. ${
              processError.message || "Please try a smaller image."
            }`
          );
          submitBtn.disabled = false;
          submitBtn.textContent = "Post Item";
          return;
        }
      }

      const itemData = {
        itemName,
        locationFound,
        contactInfo,
        itemType, 
        postedBy: user.email,
        postedByName: user.displayName || user.email,
        timestamp: serverTimestamp(),
        imageUrl: imageUrl,
      };

      await addDoc(collection(db, "foundItems"), itemData);
      await checkAndDeleteOldPosts();

      foundItemForm.reset();
      imagePreview.style.display = "none";
      postSection.style.display = "none";
      toggleFormBtn.innerHTML =
        '<span class="btn-icon">➕</span> Post New Item';

      submitBtn.disabled = false;
      submitBtn.textContent = "Post Item";
    } catch (error) {
      console.error("Error posting item:", error);
      let errorMessage = "Failed to post item. ";

      if (error.code === "permission-denied") {
        errorMessage += "Permission denied. Check Firestore security rules.";
      } else if (error.code === "unavailable") {
        errorMessage += "Firestore unavailable. Check your connection.";
      } else {
        errorMessage += `Error: ${error.message || error.code || "Unknown"}`;
      }

      alert(errorMessage);
      const submitBtn = foundItemForm.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = "Post Item";
    }
  });

  // Filter and display items
  function filterAndDisplayItems() {
    itemsList.innerHTML = "";

    const filteredItems = allItems.filter((item) => {
      // Filter by category
      if (currentCategory !== "all" && item.itemType !== currentCategory) {
        return false;
      }

      // Filter by search term
      if (!searchTerm) return true;

      const searchLower = searchTerm.toLowerCase();
      const itemName = (item.itemName || "").toLowerCase();
      const location = (item.locationFound || "").toLowerCase();

      return itemName.includes(searchLower) || location.includes(searchLower);
    });

    if (filteredItems.length === 0 && allItems.length > 0) {
      noResults.style.display = "block";
      emptyState.style.display = "none";
    } else if (filteredItems.length === 0 && allItems.length === 0) {
      noResults.style.display = "none";
      emptyState.style.display = "block";
    } else {
      noResults.style.display = "none";
      emptyState.style.display = "none";

      filteredItems.forEach((item) => {
        displayItem(item);
      });
    }
  }

  // Helper function to format timestamp (similar to displayItem logic)
  function formatTimestamp(timestamp) {
    if (!timestamp) return "Unknown time";
    const tsDate = timestamp.toDate();
    const now = new Date();
    const diffMs = now - tsDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60)
      return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }

  // Load feed (updated to build knowledgeBase once)
  function loadFeed() {
    loading.style.display = "block";
    emptyState.style.display = "none";
    noResults.style.display = "none";
    itemsList.innerHTML = "";
    allItems = [];

    const itemsQuery = query(
      collection(db, "foundItems"),
      orderBy("timestamp", "desc")
    );

    onSnapshot(
      itemsQuery,
      (snapshot) => {
        loading.style.display = "none";

        if (snapshot.empty) {
          emptyState.style.display = "block";
          noResults.style.display = "none";
          allItems = [];
          knowledgeBase = ""; // Reset if no items
          conversationHistory = []; // Reset conversation
          return;
        }

        allItems = [];
        snapshot.forEach((doc) => {
          const item = { id: doc.id, ...doc.data() };
          allItems.push(item);
        });

        // Build knowledgeBase once from allItems (now includes contact info, poster, and time)
        knowledgeBase = allItems
          .map((item) => {
            const timeAgo = formatTimestamp(item.timestamp);
            return `- ${item.itemType === "lost" ? "LOST" : "FOUND"}: ${
              item.itemName
            }, Location: ${item.locationFound}, Contact: ${
              item.contactInfo
            }, Posted by: ${item.postedByName}, Time: ${timeAgo}`;
          })
          .join("\n");

        // Reset conversation history when data updates
        conversationHistory = [];

        filterAndDisplayItems();
      },
      (error) => {
        console.error("Error loading feed:", error);
        loading.style.display = "none";

        let errorMessage = "Error loading items. ";
        if (error.code === "permission-denied") {
          errorMessage = "Permission denied. Check Firestore security rules.";
        } else if (error.code === "failed-precondition") {
          errorMessage = 'Index required for "timestamp" field.';
        } else if (error.code === "unavailable") {
          errorMessage = "Firestore unavailable. Check your connection.";
        } else {
          errorMessage += `${error.message || error.code || "Unknown"}`;
        }

        itemsList.innerHTML = `<p class="error-message">${errorMessage}</p>`;
      }
    );
  }

  // Display a single item
  function displayItem(item) {
    const itemCard = document.createElement("div");
    itemCard.className = `item-card ${item.itemType || "found"}`;

    // Format timestamp
    let timeAgo = "Just now";
    if (item.timestamp) {
      const timestamp = item.timestamp.toDate();
      const now = new Date();
      const diffMs = now - timestamp;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) {
        timeAgo = "Just now";
      } else if (diffMins < 60) {
        timeAgo = `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
      } else if (diffHours < 24) {
        timeAgo = `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
      } else {
        timeAgo = `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
      }
    }

    const itemTypeLabel =
      item.itemType === "lost"
        ? '<span class="item-badge lost">Lost Item</span>'
        : '<span class="item-badge found">Found Item</span>';

    const imageHtml = item.imageUrl
      ? `<div class="item-image-container" onclick="openImageModal('${escapeHtml(
          item.imageUrl
        )}', '${escapeHtml(item.itemName)}')">
           <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(
          item.itemName
        )}" class="item-image" loading="lazy">
           <div class="image-overlay">
             <span class="zoom-icon">🔍</span>
           </div>
         </div>`
      : "";

    itemCard.innerHTML = `
      <div class="item-header">
        <div class="item-title-row">
          <h3>${escapeHtml(item.itemName)}</h3>
          ${itemTypeLabel}
        </div>
        <span class="item-time">${timeAgo}</span>
      </div>
      ${imageHtml}
      <div class="item-details">
        <p><strong>📍 Location:</strong> ${escapeHtml(item.locationFound)}</p>
        <p><strong>📞 Contact:</strong> ${escapeHtml(item.contactInfo)}</p>
        <p class="item-poster">Posted by ${escapeHtml(item.postedByName)}</p>
      </div>
    `;

    itemsList.appendChild(itemCard);
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Global variables for chatbot optimization
  let knowledgeBase = ""; // Built once from allItems
  let conversationHistory = []; // Array to maintain conversation history

  // Chatbot
  async function askChatbot(userQuery) {
    const GEMINI_API_KEY = "your_gemini_api_key_here"; // Replace with your Gemini API key
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;

    // If conversation history is empty, add initial context with knowledgeBase
    if (conversationHistory.length === 0) {
      conversationHistory.push({
        role: "user",
        parts: [
          {
            text: `You are a campus assistant. Use this knowledge base for context:\n${knowledgeBase}\n\nRespond based on this data and maintain conversation continuity.`,
          },
        ],
      });
    }

    // Append the new user query to history
    conversationHistory.push({
      role: "user",
      parts: [{ text: userQuery }],
    });

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: conversationHistory, // Send full history for continuity
        }),
      });

      const data = await response.json();

      if (data.error) {
        console.error("API Error:", data.error.message);
        // Reset history on persistent errors to avoid loops
        if (data.error.code === 429 || data.error.code === 400) {
          conversationHistory = [];
        }
        return "Error: " + data.error.message;
      }

      const botResponse = data.candidates[0].content.parts[0].text;

      // Append bot response to history
      conversationHistory.push({
        role: "model",
        parts: [{ text: botResponse }],
      });

      return botResponse;
    } catch (error) {
      console.error("Fetch Error:", error);
      // Reset history on network errors
      conversationHistory = [];
      return "I'm having trouble connecting to the network.";
    }
  }

  // Function to clean Gemini response (remove asterisks or convert markdown to plain text)
  function cleanResponse(response) {
    // Remove asterisks (for emphasis) or convert simple markdown
    // Example: Replace *text* with text, or use a library like marked.js for full markdown
    return response.replace(/\*/g, ""); // Simple removal; expand if needed
  }

  // Function to append user message
  function appendUserMessage(message) {
    const chatWindow = document.getElementById("chat-window");
    const messageDiv = document.createElement("div");
    messageDiv.className = "chat-message user-message";
    messageDiv.innerHTML = `<strong>You:</strong> ${message}`;
    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  // Function to append bot message (after cleaning)
  function appendBotMessage(response) {
    const cleanedResponse = cleanResponse(response);
    const chatWindow = document.getElementById("chat-window");
    const messageDiv = document.createElement("div");
    messageDiv.className = "chat-message bot-message";
    messageDiv.innerHTML = `<strong>Bot:</strong> ${cleanedResponse}`;
    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  const sendChatBtn = document.getElementById("send-chat-btn");
  const chatInput = document.getElementById("chat-input");
  const chatWindow = document.getElementById("chat-window");

  sendChatBtn.addEventListener("click", async () => {
    const message = chatInput.value.trim();
    if (!message) return;

    appendUserMessage(message);
    chatInput.value = "";

    const botResponse = await askChatbot(message);
    appendBotMessage(botResponse);
  });

  // Enter key support for chat
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendChatBtn.click();
    }
  });

  // Modal Logic
  const imageModal = document.getElementById("image-modal");
  const modalImg = document.getElementById("modal-image");
  const modalClose = document.querySelector(".image-modal-close");

  window.openImageModal = function (src, alt) {
    imageModal.style.display = "flex";
    imageModal.style.flexDirection = "column";
    modalImg.src = src;
    document.querySelector(".image-modal-caption").textContent = alt;
  };

  modalClose.onclick = () => (imageModal.style.display = "none");
  imageModal.onclick = (e) => {
    if (e.target === imageModal) imageModal.style.display = "none";
  };

  const openChatbotBtn = document.getElementById("open-chatbot-btn");
  const closeChatbotBtn = document.getElementById("close-chatbot-btn");
  const chatbotModal = document.getElementById("chatbot-modal");

  openChatbotBtn.addEventListener("click", () => {
    chatbotModal.style.display = "flex";
  });

  closeChatbotBtn.addEventListener("click", () => {
    chatbotModal.style.display = "none";
  });

  // Close chatbot if clicking outside the container
  chatbotModal.addEventListener("click", (e) => {
    if (e.target === chatbotModal) chatbotModal.style.display = "none";
  });
}

// Start app
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
