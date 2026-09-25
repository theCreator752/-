/*
==================================================
AUTHENTICATION
==================================================

Username:
b_ore

Password:
QWERTY>123

The password itself is NOT stored.

SHA-256 hash:
ddbbea0a73a3963f05830a0de0805bf3b779bec1edbfd00423fb6aaa2c1bc13b

IMPORTANT:
This is client-side authentication.
For real production security, authentication should
be moved to a backend.
*/

const AUTH_USERNAME = "b_ore";

const AUTH_PASSWORD_HASH =
  "ddbbea0a73a3963f05830a0de0805bf3b779bec1edbfd00423fb6aaa2c1bc13b";

const AUTH_SESSION_KEY =
  "video_collection_auth";

const AUTH_ATTEMPTS_KEY =
  "video_collection_auth_attempts";

const AUTH_LOCK_KEY =
  "video_collection_auth_lock";

const SESSION_TIMEOUT_MS =
  30 * 60 * 1000;

let authTimer = null;


/*
==================================================
PASSWORD HASH
==================================================
*/

async function sha256(value) {

  const bytes =
    new TextEncoder().encode(value);

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      bytes
    );

  return Array
    .from(new Uint8Array(digest))
    .map(
      b => b
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}


/*
==================================================
CHECK AUTHENTICATION
==================================================
*/

function isAuthenticated() {

  const session =
    sessionStorage.getItem(
      AUTH_SESSION_KEY
    );

  if (!session) {
    return false;
  }

  try {

    const parsed =
      JSON.parse(session);

    if (
      !parsed.authenticated ||
      Date.now() - parsed.lastActivity >
      SESSION_TIMEOUT_MS
    ) {

      sessionStorage.removeItem(
        AUTH_SESSION_KEY
      );

      return false;
    }

    return true;

  } catch {

    sessionStorage.removeItem(
      AUTH_SESSION_KEY
    );

    return false;
  }
}


/*
==================================================
UPDATE SESSION
==================================================
*/

function touchSession() {

  if (!isAuthenticated()) {
    return;
  }

  sessionStorage.setItem(
    AUTH_SESSION_KEY,

    JSON.stringify({
      authenticated: true,
      lastActivity: Date.now()
    })
  );

  clearTimeout(authTimer);

  authTimer =
    setTimeout(
      lockForInactivity,
      SESSION_TIMEOUT_MS
    );
}


/*
==================================================
SESSION TIMEOUT
==================================================
*/

function lockForInactivity() {

  sessionStorage.removeItem(
    AUTH_SESSION_KEY
  );

  document.body.classList.add(
    "auth-locked"
  );

  document.getElementById(
    "loginPassword"
  ).value = "";

  document.getElementById(
    "authError"
  ).textContent =
    "Session expired. Please sign in again.";
}


/*
==================================================
LOCKOUT
==================================================
*/

function getLockoutRemaining() {

  const until =
    Number(
      localStorage.getItem(
        AUTH_LOCK_KEY
      ) || 0
    );

  return Math.max(
    0,
    until - Date.now()
  );
}


/*
==================================================
LOGIN
==================================================
*/

async function login() {

  const username =
    document
      .getElementById("loginUsername")
      .value
      .trim();

  const password =
    document
      .getElementById("loginPassword")
      .value;

  const error =
    document.getElementById(
      "authError"
    );

  const button =
    document.getElementById(
      "loginButton"
    );


  const remaining =
    getLockoutRemaining();


  if (remaining > 0) {

    error.textContent =
      `Too many attempts. Try again in ${
        Math.ceil(remaining / 1000)
      }s.`;

    return;
  }


  button.disabled = true;

  error.textContent = "";


  try {

    const passwordHash =
      await sha256(password);


    if (
      username === AUTH_USERNAME &&
      passwordHash === AUTH_PASSWORD_HASH
    ) {

      localStorage.removeItem(
        AUTH_ATTEMPTS_KEY
      );

      localStorage.removeItem(
        AUTH_LOCK_KEY
      );


      sessionStorage.setItem(
        AUTH_SESSION_KEY,

        JSON.stringify({
          authenticated: true,
          lastActivity: Date.now()
        })
      );


      document.body.classList.remove(
        "auth-locked"
      );


      document.getElementById(
        "loginPassword"
      ).value = "";


      touchSession();

    } else {

      const attempts =
        Number(
          localStorage.getItem(
            AUTH_ATTEMPTS_KEY
          ) || 0
        ) + 1;


      localStorage.setItem(
        AUTH_ATTEMPTS_KEY,
        String(attempts)
      );


      if (attempts >= 5) {

        localStorage.setItem(
          AUTH_LOCK_KEY,

          String(
            Date.now() +
            60 * 1000
          )
        );

        localStorage.removeItem(
          AUTH_ATTEMPTS_KEY
        );


        error.textContent =
          "Too many failed attempts. Login locked for 60 seconds.";

      } else {

        error.textContent =
          `Invalid username or password. ${
            5 - attempts
          } attempts remaining.`;
      }
    }

  } finally {

    button.disabled = false;
  }
}


/*
==================================================
LOGOUT
==================================================
*/

function logout() {

  sessionStorage.removeItem(
    AUTH_SESSION_KEY
  );

  clearTimeout(authTimer);

  document.body.classList.add(
    "auth-locked"
  );


  document.getElementById(
    "loginUsername"
  ).value = "";

  document.getElementById(
    "loginPassword"
  ).value = "";

  document.getElementById(
    "authError"
  ).textContent = "";


  setTimeout(
    () =>
      document
        .getElementById("loginUsername")
        .focus(),
    50
  );
}


/*
==================================================
REQUIRE AUTH
==================================================
*/

function requireAuth() {

  if (isAuthenticated()) {

    document.body.classList.remove(
      "auth-locked"
    );

    touchSession();

  } else {

    document.body.classList.add(
      "auth-locked"
    );
  }
}


/*
==================================================
SESSION ACTIVITY
==================================================
*/

[
  "click",
  "keydown",
  "touchstart"
].forEach(eventName => {

  document.addEventListener(
    eventName,
    () => touchSession(),
    {
      passive: true
    }
  );

});


/*
==================================================
VIDEO DATA
==================================================
*/

const STORAGE_KEY =
  "video_collection_app";


let data =
  JSON.parse(
    localStorage.getItem(
      STORAGE_KEY
    )
  );


/*
==================================================
FIRST-TIME SETUP
==================================================
*/

if (!data) {

  data = {

    collections: [

      {
        id: "default",

        name: "My Videos",

        videos: []
      }

    ],

    videos: []
  };


  saveData();
}


/*
==================================================
SELECTED COLLECTION
==================================================
*/

let selectedCollectionId =
  data.collections[0]?.id;


/*
==================================================
SAVE
==================================================
*/

function saveData() {

  localStorage.setItem(
    STORAGE_KEY,

    JSON.stringify(data)
  );
}


/*
==================================================
GET SELECTED COLLECTION
==================================================
*/

function getSelectedCollection() {

  return data.collections.find(
    collection =>
      collection.id ===
      selectedCollectionId
  );
}


/*
==================================================
YOUTUBE ID
==================================================
*/

function getYouTubeId(url) {

  try {

    const parsed =
      new URL(url);


    if (
      parsed.hostname.includes(
        "youtube.com"
      ) &&
      parsed.searchParams.get("v")
    ) {

      return parsed.searchParams.get("v");
    }


    if (
      parsed.hostname.includes(
        "youtube.com"
      ) &&
      parsed.pathname.startsWith(
        "/shorts/"
      )
    ) {

      return parsed.pathname
        .split("/shorts/")[1]
        .split("/")[0];
    }


    if (
      parsed.hostname.includes(
        "youtube.com"
      ) &&
      parsed.pathname.startsWith(
        "/embed/"
      )
    ) {

      return parsed.pathname
        .split("/embed/")[1]
        .split("/")[0];
    }


    if (
      parsed.hostname ===
      "youtu.be"
    ) {

      return parsed.pathname
        .substring(1)
        .split("/")[0];
    }


    return null;

  } catch {

    return null;
  }
}


/*
==================================================
INSTAGRAM CHECK
==================================================
*/

function isInstagramUrl(url) {

  try {

    const parsed =
      new URL(url);

    return (
      parsed.hostname ===
        "instagram.com" ||

      parsed.hostname ===
        "www.instagram.com"
    );

  } catch {

    return false;
  }
}


/*
==================================================
ADD VIDEO
==================================================
*/

function addVideo() {

  if (!isAuthenticated()) {
    return;
  }


  const input =
    document.getElementById(
      "videoUrl"
    );

  const message =
    document.getElementById(
      "message"
    );


  const url =
    input.value.trim();


  message.textContent = "";


  if (!url) {

    message.textContent =
      "Please paste a video URL.";

    return;
  }


  const collection =
    getSelectedCollection();


  if (!collection) {

    message.textContent =
      "Please select a collection.";

    return;
  }


  /*
  YouTube
  */

  const youtubeId =
    getYouTubeId(url);


  if (youtubeId) {

    let video =
      data.videos.find(
        item =>
          item.url === url
      );


    if (!video) {

      video = {

        id:
          "video_" +
          Date.now(),

        platform:
          "youtube",

        url: url,

        videoId:
          youtubeId
      };


      data.videos.push(
        video
      );
    }


    if (
      collection.videos.includes(
        video.id
      )
    ) {

      message.textContent =
        "This video is already in this collection.";

      return;
    }


    collection.videos.push(
      video.id
    );


    saveData();

    input.value = "";

    render();

    return;
  }


  /*
  Instagram
  */

  if (
    isInstagramUrl(url)
  ) {

    let video =
      data.videos.find(
        item =>
          item.url === url
      );


    if (!video) {

      video = {

        id:
          "video_" +
          Date.now(),

        platform:
          "instagram",

        url: url
      };


      data.videos.push(
        video
      );
    }


    if (
      collection.videos.includes(
        video.id
      )
    ) {

      message.textContent =
        "This video is already in this collection.";

      return;
    }


    collection.videos.push(
      video.id
    );


    saveData();

    input.value = "";

    render();

    return;
  }


  message.textContent =
    "Please enter a valid YouTube or Instagram URL.";
}


/*
==================================================
CREATE COLLECTION
==================================================
*/

function createCollection() {

  if (!isAuthenticated()) {
    return;
  }


  const input =
    document.getElementById(
      "collectionNameInput"
    );


  const name =
    input.value.trim();


  if (!name) {
    return;
  }


  const collection = {

    id:
      "collection_" +
      Date.now(),

    name: name,

    videos: []
  };


  data.collections.push(
    collection
  );


  selectedCollectionId =
    collection.id;


  saveData();

  input.value = "";

  closeCollectionModal();

  render();
}


/*
==================================================
DELETE COLLECTION
==================================================
*/

function deleteCollection(id) {

  if (!isAuthenticated()) {
    return;
  }


  if (
    data.collections.length <= 1
  ) {

    alert(
      "You must keep at least one collection."
    );

    return;
  }


  const collection =
    data.collections.find(
      item =>
        item.id === id
    );


  if (!collection) {
    return;
  }


  const confirmed =
    confirm(
      `Delete "${collection.name}"?`
    );


  if (!confirmed) {
    return;
  }


  data.collections =
    data.collections.filter(
      item =>
        item.id !== id
    );


  if (
    selectedCollectionId === id
  ) {

    selectedCollectionId =
      data.collections[0].id;
  }


  saveData();

  render();
}


/*
==================================================
REMOVE VIDEO
==================================================
*/

function removeFromCollection(
  videoId
) {

  if (!isAuthenticated()) {
    return;
  }


  const collection =
    getSelectedCollection();


  if (!collection) {
    return;
  }


  collection.videos =
    collection.videos.filter(
      id =>
        id !== videoId
    );


  saveData();

  render();
}


/*
==================================================
SELECT COLLECTION
==================================================
*/

function selectCollection(id) {

  if (!isAuthenticated()) {
    return;
  }

  selectedCollectionId =
    id;

  render();
}


/*
==================================================
OPEN ORIGINAL VIDEO
==================================================
*/

function openVideo(url) {

  if (!isAuthenticated()) {
    return;
  }


  window.open(
    url,
    "_blank",
    "noopener,noreferrer"
  );
}


/*
==================================================
RENDER
==================================================
*/

function render() {

  if (!isAuthenticated()) {
    return;
  }

  renderCollections();

  renderSelectedCollection();

  renderVideos();
}


/*
==================================================
COLLECTION SIDEBAR
==================================================
*/

function renderCollections() {

  const list =
    document.getElementById(
      "collectionList"
    );


  list.innerHTML =
    data.collections
      .map(collection => {

        const active =
          collection.id ===
          selectedCollectionId
            ? "active"
            : "";


        return `

          <div
            class="collection-item ${active}"
            onclick="selectCollection('${collection.id}')">

            <span class="collection-name">
              📁 ${escapeHtml(collection.name)}
            </span>

            <span class="collection-count">
              ${collection.videos.length}
            </span>

          </div>

        `;

      })
      .join("");
}


/*
==================================================
SELECTED COLLECTION INFO
==================================================
*/

function renderSelectedCollection() {

  const collection =
    getSelectedCollection();


  if (!collection) {
    return;
  }


  document.getElementById(
    "collectionTitle"
  ).textContent =
    collection.name;


  document.getElementById(
    "selectedCollection"
  ).textContent =
    `Adding to: ${collection.name}`;
}


/*
==================================================
VIDEO GRID
==================================================
*/

function renderVideos() {

  const grid =
    document.getElementById(
      "videoGrid"
    );

  const count =
    document.getElementById(
      "videoCount"
    );


  const collection =
    getSelectedCollection();


  if (!collection) {
    return;
  }


  count.textContent =
    `${collection.videos.length} video${
      collection.videos.length === 1
        ? ""
        : "s"
    }`;


  if (
    collection.videos.length === 0
  ) {

    grid.innerHTML = `

      <div class="empty">

        <h3>
          This collection is empty
        </h3>

        <p>
          Paste a YouTube or Instagram URL above
          to add your first video.
        </p>

      </div>

    `;

    return;
  }


  const videos =
    collection.videos
      .map(id =>
        data.videos.find(
          video =>
            video.id === id
        )
      )
      .filter(Boolean);


  grid.innerHTML =
    videos
      .map(video => {

        /*
        YouTube
        */

        if (
          video.platform ===
          "youtube"
        ) {

          return `

            <article class="video-card">

              <div class="video-wrapper">

                <iframe
                  src="https://www.youtube.com/embed/${escapeAttribute(video.videoId)}"
                  title="YouTube video"
                  allow="
                    accelerometer;
                    autoplay;
                    clipboard-write;
                    encrypted-media;
                    gyroscope;
                    picture-in-picture;
                    web-share
                  "
                  allowfullscreen>
                </iframe>

              </div>


              <div class="card-content">

                <span class="platform youtube">
                  YOUTUBE
                </span>


                <div class="url">
                  ${escapeHtml(video.url)}
                </div>


                <div class="card-actions">

                  <button
                    class="open-btn"
                    onclick="openVideo('${escapeAttribute(video.url)}')">
                    Open
                  </button>


                  <button
                    class="remove-btn"
                    onclick="removeFromCollection('${video.id}')">
                    Remove
                  </button>

                </div>

              </div>

            </article>

          `;
        }


        /*
        Instagram
        */

        if (
          video.platform ===
          "instagram"
        ) {

          return `

            <article class="video-card">

              <div class="video-wrapper">

                <blockquote
                  class="instagram-media"
                  data-instgrm-permalink="${escapeAttribute(video.url)}"
                  data-instgrm-version="14">
                </blockquote>

              </div>


              <div class="card-content">

                <span class="platform instagram">
                  INSTAGRAM
                </span>


                <div class="url">
                  ${escapeHtml(video.url)}
                </div>


                <div class="card-actions">

                  <button
                    class="open-btn"
                    onclick="openVideo('${escapeAttribute(video.url)}')">
                    Open
                  </button>


                  <button
                    class="remove-btn"
                    onclick="removeFromCollection('${video.id}')">
                    Remove
                  </button>

                </div>

              </div>

            </article>

          `;
        }


        return "";

      })
      .join("");


  /*
  Process Instagram embeds
  */

  if (
    window.instgrm &&
    window.instgrm.Embeds
  ) {

    window.instgrm.Embeds.process();
  }
}


/*
==================================================
MODAL
==================================================
*/

function openCollectionModal() {

  if (!isAuthenticated()) {
    return;
  }


  document
    .getElementById(
      "collectionModal"
    )
    .classList.add("show");


  setTimeout(() => {

    document
      .getElementById(
        "collectionNameInput"
      )
      .focus();

  }, 100);
}


function closeCollectionModal() {

  document
    .getElementById(
      "collectionModal"
    )
    .classList.remove(
      "show"
    );
}


/*
==================================================
ENTER / ESCAPE
==================================================
*/

document
  .getElementById(
    "collectionNameInput"
  )
  .addEventListener(
    "keydown",
    function(event) {

      if (
        event.key ===
        "Enter"
      ) {

        createCollection();
      }


      if (
        event.key ===
        "Escape"
      ) {

        closeCollectionModal();
      }

    }
  );


/*
==================================================
VIDEO ENTER KEY
==================================================
*/

document
  .getElementById(
    "videoUrl"
  )
  .addEventListener(
    "keydown",
    function(event) {

      if (
        event.key ===
        "Enter"
      ) {

        addVideo();
      }

    }
  );


/*
==================================================
HTML ESCAPING
==================================================
*/

function escapeHtml(value) {

  return String(value)

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );
}


function escapeAttribute(value) {

  return escapeHtml(value);
}


/*
==================================================
INITIALIZE
==================================================
*/

requireAuth();

if (isAuthenticated()) {
  render();
}
