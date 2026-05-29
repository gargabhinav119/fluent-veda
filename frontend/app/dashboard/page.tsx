"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { isAuthenticated } from "@/lib/auth";

export default function DashboardPage() {

  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [completion, setCompletion] = useState(0);

  const fetchProfile = async () => {

    const token = localStorage.getItem("token");

    const response = await fetch(
      "http://127.0.0.1:8000/profile",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    setUser(data.user);

    const fields = [
      data.user.name,
      data.user.phone,
      data.user.interested_in,
      data.user.tagline,
    ];

    const completedFields =
      fields.filter(
        (field) =>
          field &&
          field.toString().trim() !== ""
      ).length;

    setCompletion(
      Math.round(
        (completedFields / 4) * 100
      )
    );
  };

  useEffect(() => {

    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }

    fetchProfile();

  }, []);

  return (
    <div className="flex">

      <Sidebar />

      <div className="flex-1 p-10">

        <h1 className="text-4xl font-bold mb-8">
          Dashboard
        </h1>

        {user && (

          <div className="border rounded-lg p-6 mb-8">

            <h2 className="text-2xl font-semibold mb-3">
              Welcome, {user.name}
            </h2>

            {completion < 100 ? (

              <>
                <p className="text-orange-600 mb-4">
                  Complete your profile
                </p>

                <div className="w-full bg-gray-200 h-4 rounded">

                  <div
                    className="bg-green-500 h-4 rounded"
                    style={{
                      width: `${completion}%`,
                    }}
                  />

                </div>

                <p className="mt-3">
                  Profile Completion:
                  {" "}
                  {completion}%
                </p>

                <button
                  onClick={() =>
                    router.push("/profile")
                  }
                  className="mt-4 bg-black text-white px-4 py-2 rounded"
                >
                  Complete Profile
                </button>

              </>

            ) : (

              <div>

                <p className="text-green-600 font-semibold">
                  Profile Complete ✅
                </p>

              </div>

            )}

          </div>

        )}

      </div>

    </div>
  );
}