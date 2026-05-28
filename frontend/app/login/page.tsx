"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
export default function LoginPage() {
  
    const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {

    const response = await fetch(
      "http://127.0.0.1:8000/login",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          email,
          password,
        }),
      }
    );

    const data = await response.json();

    console.log(data);

    if (data.access_token) {

      localStorage.setItem(
        "token",
        data.access_token
      );

      alert("Login successful");
        router.push("/profile");


    } else {

      alert(data.message);

    }
  };

  return (
    <div className="flex flex-col gap-4 p-10">

      <h1 className="text-3xl font-bold">
        FluentVeda Login
      </h1>

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
        onClick={handleLogin}
        className="bg-black text-white p-2"
      >
        Login
      </button>

    </div>
  );
}