
"use strict";

/*
========================================
HARVIXPANEL AUTH
Login + Register
========================================
*/

const loginForm =
  document.getElementById("loginForm");

const registerForm =
  document.getElementById("registerForm");

const showRegister =
  document.getElementById("showRegister");

const showLogin =
  document.getElementById("showLogin");

const message =
  document.getElementById("message");


/*
========================================
MESSAGE
========================================
*/

function showMessage(text, type = "error") {

  message.textContent = text;

  message.className =
    "message show " + type;

}


function clearMessage() {

  message.textContent = "";

  message.className =
    "message";

}


/*
========================================
SWITCH LOGIN / REGISTER
========================================
*/

showRegister.addEventListener(
  "click",
  function () {

    clearMessage();

    loginForm.classList.remove("active");

    registerForm.classList.add("active");

  }
);


showLogin.addEventListener(
  "click",
  function () {

    clearMessage();

    registerForm.classList.remove("active");

    loginForm.classList.add("active");

  }
);


/*
========================================
SAFE JSON RESPONSE
========================================
*/

async function readResponse(response) {

  const text =
    await response.text();

  try {

    return JSON.parse(text);

  } catch (error) {

    console.error(
      "Server returned:",
      text
    );

    throw new Error(
      "Server returned an invalid response. Check server.js."
    );

  }

}


/*
========================================
REGISTER
========================================
*/

registerForm.addEventListener(
  "submit",
  async function (event) {

    event.preventDefault();

    clearMessage();


    const firstName =
      document.getElementById(
        "firstName"
      ).value.trim();


    const lastName =
      document.getElementById(
        "lastName"
      ).value.trim();


    const username =
      document.getElementById(
        "registerUsername"
      ).value.trim();


    const email =
      document.getElementById(
        "registerEmail"
      ).value.trim();


    const password =
      document.getElementById(
        "registerPassword"
      ).value;


    const confirmPassword =
      document.getElementById(
        "registerConfirmPassword"
      ).value;


    /*
    Password check
    */

    if (password !== confirmPassword) {

      showMessage(
        "Passwords do not match."
      );

      return;

    }


    if (password.length < 6) {

      showMessage(
        "Password must be at least 6 characters."
      );

      return;

    }


    const button =
      document.getElementById(
        "registerButton"
      );


    button.disabled = true;

    button.textContent =
      "Creating account...";


    try {

      const response =
        await fetch(
          "/api/auth/register",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({

              firstName,
              lastName,
              username,
              email,
              password

            })
          }
        );


      const data =
        await readResponse(
          response
        );


      if (!response.ok) {

        throw new Error(
          data.message ||
          data.error ||
          "Registration failed."
        );

      }


      showMessage(
        data.message ||
        "Account created successfully! You can now login.",
        "success"
      );


      registerForm.reset();


      setTimeout(
        function () {

          registerForm.classList.remove(
            "active"
          );

          loginForm.classList.add(
            "active"
          );

          clearMessage();

          document.getElementById(
            "loginIdentifier"
          ).value = username;

        },
        1200
      );


    } catch (error) {

      console.error(
        "Register error:",
        error
      );

      showMessage(
        error.message ||
        "Registration failed."
      );

    } finally {

      button.disabled = false;

      button.textContent =
        "Register";

    }

  }
);


/*
========================================
LOGIN
========================================
*/

loginForm.addEventListener(
  "submit",
  async function (event) {

    event.preventDefault();

    clearMessage();


    const identifier =
      document.getElementById(
        "loginIdentifier"
      ).value.trim();


    const password =
      document.getElementById(
        "loginPassword"
      ).value;


    if (!identifier || !password) {

      showMessage(
        "Enter your username/email and password."
      );

      return;

    }


    const button =
      document.getElementById(
        "loginButton"
      );


    button.disabled = true;

    button.textContent =
      "Logging in...";


    try {

      const response =
        await fetch(
          "/api/auth/login",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({

              identifier,
              username: identifier,
              email: identifier,
              password

            })
          }
        );


      const data =
        await readResponse(
          response
        );


      if (!response.ok) {

        throw new Error(
          data.message ||
          data.error ||
          "Login failed."
        );

      }


      /*
      Save token
      */

      if (data.token) {

        localStorage.setItem(
          "harvix_token",
          data.token
        );

      }


      /*
      Save user
      */

      if (data.user) {

        localStorage.setItem(
          "harvix_user",
          JSON.stringify(
            data.user
          )
        );

      }


      showMessage(
        "Login successful! Redirecting...",
        "success"
      );


      /*
      Redirect
      */

      setTimeout(
        function () {

          if (
            data.user &&
            data.user.role === "admin"
          ) {

            window.location.href =
              "/admin.html";

          } else {

            window.location.href =
              "/dashboard.html";

          }

        },
        500
      );


    } catch (error) {

      console.error(
        "Login error:",
        error
      );

      showMessage(
        error.message ||
        "Login failed."
      );

    } finally {

      button.disabled = false;

      button.textContent =
        "Login";

    }

  }
)
