"use client";

import { useCallback, useEffect, useState } from "react";
import { BellOff, BellRing, CircleCheck, Send } from "lucide-react";

type PushStatus =
  | "loading"
  | "available"
  | "enabled"
  | "denied"
  | "unsupported"
  | "unavailable"
  | "error";

type PushConfigResponse = {
  ready?: boolean;
  publicKey?: string;
  activeSubscriptions?: number;
  message?: string;
};

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(Array.from(raw, (character) => character.charCodeAt(0)));
}

function subscriptionPayload(subscription: PushSubscription) {
  const serialized = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: serialized.keys?.p256dh || "",
      auth: serialized.keys?.auth || "",
    },
    deviceLabel: `${navigator.platform || "Desktop"} · ${navigator.userAgent.includes("Edg/") ? "Edge" : navigator.userAgent.includes("Chrome/") ? "Chrome" : navigator.userAgent.includes("Safari/") ? "Safari" : "Browser"}`,
  };
}

async function readJson(response: Response) {
  return (await response.json().catch(() => ({}))) as PushConfigResponse;
}

export function DesktopNotificationControl() {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [message, setMessage] = useState("檢查桌面通知支援中…");
  const [publicKey, setPublicKey] = useState("");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);

  const registerWorker = useCallback(async () => {
    const registration = await navigator.serviceWorker.register("/growth-os-sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    await navigator.serviceWorker.ready;
    return registration;
  }, []);

  const syncSubscription = useCallback(async (nextSubscription: PushSubscription) => {
    const response = await fetch("/api/notifications/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscriptionPayload(nextSubscription)),
    });
    if (!response.ok) {
      const data = await readJson(response);
      throw new Error(data.message || "未能同步桌面通知裝置。");
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!active) return;
        setStatus("unsupported");
        setMessage("呢個瀏覽器未支援 Web Push；建議使用最新版 Chrome、Edge 或 Safari。");
        return;
      }
      if (Notification.permission === "denied") {
        if (!active) return;
        setStatus("denied");
        setMessage("瀏覽器已封鎖通知；請喺網址列網站設定重新允許通知。");
        return;
      }

      try {
        const configResponse = await fetch("/api/notifications/push", {
          cache: "no-store",
        });
        const config = await readJson(configResponse);
        if (!configResponse.ok || !config.ready || !config.publicKey) {
          if (!active) return;
          setStatus("unavailable");
          setMessage(
            config.message ||
              "桌面通知只支援已登入嘅個人受邀帳戶；共用管理員登入唔會綁定私人裝置。"
          );
          return;
        }
        const registration = await registerWorker();
        const existing = await registration.pushManager.getSubscription();
        if (!active) return;
        setPublicKey(config.publicKey);
        setSubscription(existing);
        if (existing) {
          await syncSubscription(existing);
          if (!active) return;
          setStatus("enabled");
          setMessage("桌面通知已開啟；關閉 Growth OS 分頁後仍可收到派 Job、Start Day、Due Day、留言及逾期提醒。");
        } else {
          setStatus("available");
          setMessage("開啟後，即使 Growth OS 分頁已關閉，仍可收到真正桌面通知。");
        }
      } catch (error) {
        if (!active) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "未能初始化桌面通知。");
      }
    }
    void initialize();
    return () => {
      active = false;
    };
  }, [registerWorker, syncSubscription]);

  async function enableNotifications() {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission =
        Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "available");
        setMessage(
          permission === "denied"
            ? "瀏覽器已封鎖通知；請喺網址列網站設定重新允許通知。"
            : "你未允許通知；Growth OS 唔會再自動彈出權限視窗。"
        );
        return;
      }
      const registration = await registerWorker();
      const nextSubscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      await syncSubscription(nextSubscription);
      setSubscription(nextSubscription);
      setStatus("enabled");
      setMessage("桌面通知已開啟；新 Job、Start Day、Due Day、留言同逾期提醒會直接送到呢部裝置。");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "開啟桌面通知失敗。");
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    if (!subscription) return;
    setBusy(true);
    try {
      await fetch("/api/notifications/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
      setSubscription(null);
      setStatus("available");
      setMessage("呢部裝置嘅桌面通知已關閉；系統內通知仍會保留。");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "關閉桌面通知失敗。");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      const response = await fetch("/api/notifications/push/test", { method: "POST" });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.message || "未能送出測試通知。");
      setMessage("測試通知已送出；正常情況下會即時出現喺作業系統通知中心。");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "測試通知失敗。");
    } finally {
      setBusy(false);
    }
  }

  const enabled = status === "enabled";
  return (
    <section
      className="m-3 rounded-2xl border border-[#e6d5cd] bg-[#fffaf7] p-3"
      data-testid="desktop-notification-control"
    >
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${enabled ? "bg-[#e9f7ef] text-[#3d7f5e]" : "bg-[#fff0f5] text-[#7c365f]"}`}>
          {enabled ? <CircleCheck size={17} /> : <BellRing size={17} />}
        </span>
        <div className="min-w-0 flex-1">
          <strong className="text-xs text-[#321428]">桌面通知</strong>
          <p className="mt-1 text-[10px] font-semibold leading-4 text-[#806174]" aria-live="polite">
            {message}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {status === "available" || status === "error" ? (
          <button
            type="button"
            onClick={enableNotifications}
            disabled={busy || !publicKey}
            className="inline-flex items-center gap-1 rounded-lg bg-[#7c365f] px-2.5 py-1.5 text-[10px] font-black text-white disabled:opacity-50"
          >
            <BellRing size={12} /> {busy ? "處理中…" : "開啟桌面通知"}
          </button>
        ) : null}
        {enabled ? (
          <>
            <button
              type="button"
              onClick={sendTest}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg border border-[#d8c7bf] bg-white px-2.5 py-1.5 text-[10px] font-black text-[#53677e] disabled:opacity-50"
            >
              <Send size={12} /> 發送測試
            </button>
            <button
              type="button"
              onClick={disableNotifications}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg border border-[#e8c8c4] bg-white px-2.5 py-1.5 text-[10px] font-black text-[#a34c46] disabled:opacity-50"
            >
              <BellOff size={12} /> 關閉此裝置
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
