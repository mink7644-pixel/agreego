"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function SupabaseStatus() {
  const [status, setStatus] =
    useState("Supabase 연결 확인 중...");

  useEffect(() => {
    async function checkConnection() {
      try {
        const { error } = await supabase
          .from("trips")
          .select("id")
          .limit(1);

        if (error) {
  console.error(error);
  setStatus("Supabase 연결에 실패했습니다.");
  return;
}

        /*
         * connection_test 테이블은 아직 없으므로
         * 테이블 없음 오류가 나와도 서버 연결은 된 상태
         */
        setStatus("Supabase 프로젝트가 연결되었습니다.");
      } catch (error) {
        console.error(error);
        setStatus("Supabase 연결에 실패했습니다.");
      }
    }

    checkConnection();
  }, []);

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500">
      {status}
    </div>
  );
}