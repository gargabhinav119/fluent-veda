"use client";

import { useState } from "react";

export default function SignupPage() {

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async () => {

    const response = await fetch(
      "http://127.0.0.1:8000/signup",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          name,
          email,
          password,
        }),
      }
    );

    const data = await response.json();

    console.log(data);

    alert(data.message);
  };

  return (
    <div className="flex flex-col gap-4 p-10">

      <h1 className="text-3xl font-bold">
        FluentVeda Signup
      </h1>

      <input
        type="text"
        placeholder="Name"
        className="border p-2"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        type="email"
        placeholder="Email"
        className="border p-2"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        className="border p-2"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        onClick={handleSignup}
        className="bg-black text-white p-2"
      >
        Signup
      </button>

    </div>
  );
}