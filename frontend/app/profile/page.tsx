"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {

  const router = useRouter();

  const [user, setUser] = useState<any>(null);

  const fetchProfile = async () => {

    const token = localStorage.getItem("token");

    const response = await fetch(
      "http://127.0.0.1:8000/profile",
      {
        method: "GET",

        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    console.log(data);

    setUser(data.user);
  };

  const handleLogout = () => {

  localStorage.removeItem("token");

  alert("Logged out");

  router.push("/login");
};

  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <div className="p-10">

      <h1 className="text-3xl font-bold mb-5">
        FluentVeda Profile
      </h1>

      {user ? (

        <div className="flex flex-col gap-3">

            

          <p>
            <strong>User ID:</strong>
            {" "}
            {user.user_id}
          </p>

          <p>
            <strong>Email:</strong>
            {" "}
            {user.email}
          </p>

          <button
  onClick={handleLogout}
  className="bg-red-500 text-white p-2 mt-5"
>
  Logout
</button>

        </div>

      ) : (

        <p>Loading...</p>

      )}

    </div>
  );
}