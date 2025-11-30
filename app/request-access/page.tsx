// app/request-access/page.tsx
"use client";

import { useState, FormEvent } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function RequestAccessPage() {
  const supabase = createClientComponentClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [favoriteChannel, setFavoriteChannel] = useState("");
  const [volunteerInterest, setVolunteerInterest] = useState("maybe");
  const [donateInterest, setDonateInterest] = useState("maybe");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccess(false);

    const { error } = await supabase.from("signup_requests").insert({
      email,
      name,
      reason,
      favorite_channel: favoriteChannel,
      volunteer_interest: volunteerInterest,
      donate_interest: donateInterest,
      note,
    });

    if (error) {
      console.error("Error saving signup request:", error);
      setErrorMsg(
        "There was a problem sending your request. Please try again."
      );
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
    setName("");
    setEmail("");
    setReason("");
    setFavoriteChannel("");
    setVolunteerInterest("maybe");
    setDonateInterest("maybe");
    setNote("");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #1f3b73 0, #050816 55%, #000 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        color: "#fff",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 540,
          background: "rgba(10,20,40,0.95)",
          borderRadius: 16,
          padding: "28px 24px 24px",
          boxShadow: "0 18px 45px rgba(0,0,0,0.65)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h1
          style={{
            fontSize: "1.7rem",
            fontWeight: 700,
            marginBottom: 6,
            textAlign: "center",
          }}
        >
          Request Access to Black Truth TV
        </h1>
        <p
          style={{
            fontSize: 14,
            opacity: 0.8,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          Tell us a little about yourself and how you’d like to be part of the
          Black Truth TV community.
        </p>

        {/* 🔒 Private community / board discretion notice */}
        <p
          style={{
            fontSize: 12,
            textAlign: "center",
            marginBottom: 18,
            padding: "8px 10px",
            borderRadius: 10,
            background: "rgba(250,204,21,0.08)",
            border: "1px solid rgba(250,204,21,0.35)",
            color: "rgba(252,252,252,0.9)",
          }}
        >
          Black Truth TV is a{" "}
          <strong>private, curated community</strong>. Submitting this form{" "}
          <strong>does not guarantee access</strong>. All requests are reviewed
          and approved or declined at the sole discretion of the Black Truth TV
          board. We may choose not to provide additional explanation regarding
          individual decisions.
        </p>

        {success && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(22,163,74,0.2)",
              border: "1px solid rgba(74,222,128,0.5)",
              fontSize: 13,
            }}
          >
            Thank you! Your request has been received. If your request is
            approved, you’ll be contacted with next steps. Please note that not
            all requests are granted.
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(127,29,29,0.2)",
              border: "1px solid rgba(248,113,113,0.5)",
              fontSize: 13,
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          {/* Name */}
          <label style={{ fontSize: 13 }}>
            <span style={{ display: "block", marginBottom: 4 }}>Name</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 10px",
                borderRadius: 8,
                border: "1px solid rgba(148,163,184,0.7)",
                background: "rgba(15,23,42,0.9)",
                color: "#fff",
                fontSize: 14,
              }}
            />
          </label>

          {/* Email */}
          <label style={{ fontSize: 13 }}>
            <span style={{ display: "block", marginBottom: 4 }}>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 10px",
                borderRadius: 8,
                border: "1px solid rgba(148,163,184,0.7)",
                background: "rgba(15,23,42,0.9)",
                color: "#fff",
                fontSize: 14,
              }}
            />
          </label>

          {/* Why they want to join */}
          <label style={{ fontSize: 13 }}>
            <span style={{ display: "block", marginBottom: 4 }}>
              Why do you want to join Black Truth TV?
            </span>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                padding: "9px 10px",
                borderRadius: 8,
                border: "1px solid rgba(148,163,184,0.7)",
                background: "rgba(15,23,42,0.9)",
                color: "#fff",
                fontSize: 14,
                resize: "vertical",
              }}
            />
          </label>

          {/* Favorite channel */}
          <label style={{ fontSize: 13 }}>
            <span style={{ display: "block", marginBottom: 4 }}>
              Which channel or content area interests you the most?
            </span>
            <select
              value={favoriteChannel}
              onChange={(e) => setFavoriteChannel(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 10px",
                borderRadius: 8,
                border: "1px solid rgba(148,163,184,0.7)",
                background: "rgba(15,23,42,0.9)",
                color: "#fff",
                fontSize: 14,
              }}
            >
              <option value="">Select one…</option>
              <option value="Resistance TV (Politics & History)">
                Resistance TV (Politics & History)
              </option>
              <option value="Freedom School / Education">
                Freedom School / Education
              </option>
              <option value="Black Truth Music Experience (Channel 31)">
                Black Truth Music Experience (Channel 31)
              </option>
              <option value="Documentaries & Long-form History">
                Documentaries & Long-form History
              </option>
              <option value="Family & Youth Programming">
                Family & Youth Programming
              </option>
              <option value="Other / All of the above">
                Other / All of the above
              </option>
            </select>
          </label>

          {/* Volunteer interest */}
          <fieldset
            style={{
              border: "1px solid rgba(148,163,184,0.4)",
              borderRadius: 10,
              padding: "10px 10px 8px",
            }}
          >
            <legend
              style={{
                padding: "0 4px",
                fontSize: 12,
                opacity: 0.9,
              }}
            >
              Would you be willing to volunteer your time or skills?
            </legend>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 4,
                fontSize: 13,
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="radio"
                  name="volunteer"
                  value="yes"
                  checked={volunteerInterest === "yes"}
                  onChange={() => setVolunteerInterest("yes")}
                />
                <span>Yes</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="radio"
                  name="volunteer"
                  value="maybe"
                  checked={volunteerInterest === "maybe"}
                  onChange={() => setVolunteerInterest("maybe")}
                />
                <span>Maybe</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="radio"
                  name="volunteer"
                  value="no"
                  checked={volunteerInterest === "no"}
                  onChange={() => setVolunteerInterest("no")}
                />
                <span>No</span>
              </label>
            </div>
          </fieldset>

          {/* Donate interest */}
          <fieldset
            style={{
              border: "1px solid rgba(148,163,184,0.4)",
              borderRadius: 10,
              padding: "10px 10px 8px",
            }}
          >
            <legend
              style={{
                padding: "0 4px",
                fontSize: 12,
                opacity: 0.9,
              }}
            >
              Would you be willing to donate to support the network?
            </legend>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 4,
                fontSize: 13,
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="radio"
                  name="donate"
                  value="yes"
                  checked={donateInterest === "yes"}
                  onChange={() => setDonateInterest("yes")}
                />
                <span>Yes</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="radio"
                  name="donate"
                  value="maybe"
                  checked={donateInterest === "maybe"}
                  onChange={() => setDonateInterest("maybe")}
                />
                <span>Maybe / In the future</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="radio"
                  name="donate"
                  value="no"
                  checked={donateInterest === "no"}
                  onChange={() => setDonateInterest("no")}
                />
                <span>No</span>
              </label>
            </div>
          </fieldset>

          {/* Extra notes */}
          <label style={{ fontSize: 13 }}>
            <span style={{ display: "block", marginBottom: 4 }}>
              Anything else you want us to know? (optional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                padding: "9px 10px",
                borderRadius: 8,
                border: "1px solid rgba(148,163,184,0.7)",
                background: "rgba(15,23,42,0.9)",
                color: "#fff",
                fontSize: 14,
                resize: "vertical",
              }}
            />
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: 8,
              padding: "10px 12px",
              borderRadius: 999,
              border: "none",
              cursor: submitting ? "default" : "pointer",
              background:
                "linear-gradient(135deg, #FFD700 0%, #fbbf24 35%, #f97316 80%)",
              color: "#111827",
              fontWeight: 700,
              fontSize: 14,
              textTransform: "uppercase",
              letterSpacing: 0.06,
              boxShadow: "0 10px 25px rgba(180,83,9,0.5)",
            }}
          >
            {submitting ? "Sending…" : "Submit Request"}
          </button>
        </form>

        <p
          style={{
            marginTop: 12,
            fontSize: 12,
            textAlign: "center",
            opacity: 0.8,
          }}
        >
          Already have an account?{" "}
          <a
            href="/login"
            style={{ color: "#facc15", textDecoration: "underline" }}
          >
            Go back to login
          </a>
        </p>
      </div>
    </div>
  );
}
