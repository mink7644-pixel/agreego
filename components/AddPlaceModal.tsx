"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { supabase } from "../lib/supabase";

type SelectedPlace = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type Props = {
  tripId: string;
  participantId: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function AddPlaceModal({
  tripId,
  participantId,
  onClose,
  onSaved,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef =
    useRef<google.maps.places.PlaceAutocompleteElement | null>(null);

  const [selectedPlace, setSelectedPlace] =
    useState<SelectedPlace | null>(null);
  const [reason, setReason] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    async function setupAutocomplete() {
      try {
        const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

        if (!key) {
          setErrorMessage("Google Maps API 키가 없습니다.");
          return;
        }

        setOptions({
          key,
          v: "weekly",
          language: "ko",
          region: "KR",
        });

        const { PlaceAutocompleteElement } =
          (await importLibrary("places")) as google.maps.PlacesLibrary;

        if (cancelled) return;

        const element = new PlaceAutocompleteElement({
          placeholder: "가고 싶은 장소를 검색해주세요",
        });

        element.setAttribute("aria-label", "여행 장소 검색");
        autocompleteRef.current = element;
        container.replaceChildren(element);

        element.addEventListener(
          "gmp-select",
          async (
            event: google.maps.places.PlacePredictionSelectEvent
          ) => {
            setSearchLoading(true);
            setErrorMessage("");

            try {
              const place = event.placePrediction.toPlace();

              await place.fetchFields({
                fields: [
                  "id",
                  "displayName",
                  "formattedAddress",
                  "location",
                ],
              });

              if (
                !place.id ||
                !place.displayName ||
                !place.location
              ) {
                throw new Error("장소 정보가 부족합니다.");
              }

              if (cancelled) return;

              setSelectedPlace({
                id: place.id,
                name: place.displayName,
                address:
                  place.formattedAddress ?? "주소 정보 없음",
                latitude: place.location.lat(),
                longitude: place.location.lng(),
              });
            } catch {
              if (!cancelled) {
                setErrorMessage(
                  "장소 정보를 불러오지 못했습니다."
                );
              }
            } finally {
              if (!cancelled) setSearchLoading(false);
            }
          }
        );

        element.addEventListener("gmp-error", () => {
          if (!cancelled) {
            setErrorMessage("장소 검색 중 오류가 발생했습니다.");
          }
        });
      } catch {
        if (!cancelled) {
          setErrorMessage("Google 장소 검색을 시작하지 못했습니다.");
        }
      }
    }

    void setupAutocomplete();

    return () => {
      cancelled = true;
      autocompleteRef.current = null;
      container.replaceChildren();
    };
  }, []);

  async function handleSave() {
    if (saving) return;

    if (!selectedPlace) {
      setErrorMessage("Google 검색 결과에서 장소를 선택해주세요.");
      return;
    }

    const trimmedReason = reason.trim();

    if (!trimmedReason || trimmedReason.length > 100) {
      setErrorMessage("추천 이유를 1~100자로 입력해주세요.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const { error } = await supabase.from("places").insert({
        trip_id: tripId,
        external_place_id: selectedPlace.id,
        name: selectedPlace.name,
        category: "기타",
        address: selectedPlace.address,
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
        rating: null,
        user_rating_count: null,
        added_by: participantId,
        recommendation_reason: trimmedReason,
      });

      if (error) {
        setErrorMessage(
          error.code === "23505"
            ? "이미 후보 목록에 추가된 장소입니다."
            : "장소를 저장하지 못했습니다."
        );
        return;
      }

      onSaved();
    } catch {
      setErrorMessage("장소 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-place-title"
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[22px] bg-white p-5 shadow-xl sm:rounded-[22px]"
      >
        <div className="flex items-center justify-between">
          <h2
            id="add-place-title"
            className="text-lg font-semibold text-[#17181B]"
          >
            Add a Place
          </h2>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="닫기"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-xl text-gray-500"
          >
            ×
          </button>
        </div>

        <p className="mt-2 text-sm text-[#74777F]">
          친구들에게 추천하고 싶은 장소를 추가해 보세요.
        </p>

        <div className="mt-5">
          <label className="text-sm font-semibold text-[#17181B]">
            Place
          </label>

          <div ref={containerRef} className="mt-2 min-h-12 w-full" />

          {searchLoading && (
            <p className="mt-2 text-xs text-gray-500">
              장소 정보를 확인하는 중...
            </p>
          )}
        </div>

        {selectedPlace && (
          <div className="mt-4 rounded-xl bg-[#EEEEFF] p-4">
            <p className="text-sm font-semibold text-[#17181B]">
              {selectedPlace.name}
            </p>
            <p className="mt-1 text-xs text-[#74777F]">
              {selectedPlace.address}
            </p>
          </div>
        )}

        <div className="mt-5">
          <label
            htmlFor="new-place-reason"
            className="text-sm font-semibold text-[#17181B]"
          >
            Recommendation
          </label>

          <textarea
            id="new-place-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={100}
            rows={3}
            placeholder="이 장소를 추천하는 이유를 알려주세요."
            className="mt-2 w-full resize-none rounded-xl border border-[#E2E4E8] p-3 text-sm text-[#17181B] outline-none focus:border-[#6264F6]"
          />

          <p className="mt-1 text-right text-xs text-[#74777F]">
            {reason.length} / 100
          </p>
        </div>

        {errorMessage && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {errorMessage}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-11 flex-1 rounded-xl border border-[#E2E4E8] text-sm font-semibold"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={
              saving ||
              searchLoading ||
              !selectedPlace ||
              !reason.trim()
            }
            className="min-h-11 flex-1 rounded-xl bg-[#6264F6] text-sm font-semibold text-white disabled:opacity-40"
          >
            {saving ? "Saving..." : "Add Place"}
          </button>
        </div>
      </section>
    </div>
  );
}
