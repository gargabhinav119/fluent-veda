"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

export default function InstantConnectPage() {

  const [status, setStatus] = useState("idle");
  const [seconds, setSeconds] = useState(0);

  const joinQueue = async () => {

    try {

      const token = localStorage.getItem("token");

      const response = await fetch(
        "http://127.0.0.1:8000/instant-connect/join",
        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

const data = await response.json();

console.log(data);

setSeconds(0);

if (data.status === "matched") {

  setStatus("matched");

} else {

  setStatus("waiting");

}
    } catch (error) {

      console.error(error);

      alert("Unable to join queue");

    }
  };

  const cancelQueue = async () => {

    try {

      const token = localStorage.getItem("token");

      const response = await fetch(
        "http://127.0.0.1:8000/instant-connect/cancel",
        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      console.log(data);

      setStatus("idle");

      setSeconds(0);

    } catch (error) {

      console.error(error);

      alert("Unable to cancel search");

    }
  };

  useEffect(() => {

    let interval: NodeJS.Timeout;

    if (status === "waiting") {

      interval = setInterval(() => {

        setSeconds((prev) => prev + 1);

      }, 1000);

    }

    return () => {

      clearInterval(interval);

    };

  }, [status]);

  return (
    <div className="flex">

      <Sidebar />

      <div className="flex-1 p-10">

        <h1 className="text-3xl font-bold mb-6">
          Instant Connect
        </h1>

        <div className="border rounded-lg p-6 max-w-4xl">

          <h2 className="text-xl font-semibold mb-4">
            Purpose
          </h2>

          <p className="mb-6">
            Enables real-time interaction with other
            learners.
          </p>

          <h2 className="text-xl font-semibold mb-4">
            Features
          </h2>

          <ul className="list-disc ml-6 mb-6">

            <li>
              Instantly connect with other users
            </li>

            <li>
              Quick practice sessions
            </li>

            <li>
              Real-time communication
            </li>

          </ul>

          <h2 className="text-xl font-semibold mb-4">
            User Value
          </h2>

          <p className="mb-6">
            Encourages social learning and
            spontaneous engagement.
          </p>

          <h2 className="text-xl font-semibold mb-4">
            Rules
          </h2>

          <ul className="list-disc ml-6 mb-8">

            <li>
              Minimum 1 minute conversation required.
            </li>

            <li>
              Disconnecting before 1 minute reduces
              Honour Level by 10.
            </li>

            <li>
              Be respectful.
            </li>

            <li>
              English only.
            </li>

          </ul>

          {status === "idle" && (

            <button
              onClick={joinQueue}
              className="bg-black text-white px-6 py-3 rounded"
            >
              Connect Now
            </button>

          )}

          {status === "waiting" && (

            <div className="border rounded p-5">

              <h2 className="text-xl font-semibold mb-3">

                Searching For Partner

              </h2>

              <p className="mb-4">

                Looking for another learner...

              </p>

              <p className="mb-4">

                Waiting Time:
                {" "}
                {seconds}
                {" "}
                sec

              </p>

              <button
                onClick={cancelQueue}
                className="bg-red-500 text-white px-4 py-2 rounded"
              >
                Cancel Search
              </button>

            </div>

          )}

          {status === "matched" && (

            <div className="border rounded p-5">

              <h2 className="text-xl font-semibold mb-4">

                Match Found 🎉

              </h2>

              <div className="space-y-3">

                <p>
                  <strong>Name:</strong>
                  {" "}
                  Rahul Sharma
                </p>

                <p>
                  <strong>Tagline:</strong>
                  {" "}
                  Preparing for interviews
                </p>

                <p>
                  <strong>Interests:</strong>
                  {" "}
                  English Speaking, Interviews
                </p>

                <p>
                  <strong>Honour Level:</strong>
                  {" "}
                  95
                </p>

              </div>

            </div>

          )}

        </div>

      </div>

    </div>
  );
}