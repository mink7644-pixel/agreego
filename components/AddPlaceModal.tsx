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
  const [selectedPlace, setSelectedPlace] =
    useState<SelectedPlace | null>(null);
  const [reason, setReason] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState<
    google.maps.places.PlacePrediction[]
  >([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  const searchSessionRef = useRef<
    google.maps.places.AutocompleteSessionToken | null
  >(null);

  const searchRequestRef = useRef(0);

  useEffect(() => {
    return () => {
      searchRequestRef.current += 1;
    };
  }, []);

  // 검색 버튼을 눌렀을 때만 호출
  async function handleSearch() {
    const query = searchText.trim();

    if (query.length < 2) {
      setErrorMessage("검색어를 2글자 이상 입력해주세요.");
      return;
    }

    if (suggestionLoading) return;

    const requestId = ++searchRequestRef.current;

    setSuggestionLoading(true);
    setErrorMessage("");
    setSuggestions([]);
    setSelectedPlace(null);

    try {
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      if (!key) {
        throw new Error("Google Maps API 키가 없습니다.");
      }

      setOptions({
        key,
        v: "weekly",
        language: "ko",
        region: "KR",
      });

      const {
        AutocompleteSuggestion,
        AutocompleteSessionToken,
      } = (await importLibrary("places")) as google.maps.PlacesLibrary;

      if (!searchSessionRef.current) {
        searchSessionRef.current = new AutocompleteSessionToken();
      }

      const { suggestions: results } =
        await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          language: "ko",
          region: "KR",
          sessionToken: searchSessionRef.current,
        });

      if (requestId !== searchRequestRef.current) return;

      const places = results
        .map((item) => item.placePrediction)
        .filter(
          (place): place is google.maps.places.PlacePrediction =>
            place != null
        );

      setSuggestions(places);

      if (places.length === 0) {
        setErrorMessage("검색 결과가 없습니다. 다른 검색어를 입력해주세요.");
      }
    } catch (error) {
      console.error("장소 검색 오류:", error);

      if (requestId === searchRequestRef.current) {
        setErrorMessage(
          "장소 검색에 실패했습니다. Google API 한도도 확인해주세요."
        );
      }
    } finally {
      if (requestId === searchRequestRef.current) {
        setSuggestionLoading(false);
      }
    }
  }

  // 검색 결과에서 장소를 선택했을 때 호출
  async function handleSelectPlace(
    prediction: google.maps.places.PlacePrediction
  ) {
    searchRequestRef.current += 1;
    setSearchLoading(true);
    setSuggestions([]);
    setErrorMessage("");

    try {
      const place = prediction.toPlace();

      await place.fetchFields({
        fields: [
          "id",
          "displayName",
          "formattedAddress",
          "location",
        ],
      });

      if (!place.id || !place.displayName || !place.location) {
        throw new Error("장소 정보가 부족합니다.");
      }

      setSelectedPlace({
        id: place.id,
        name: place.displayName,
        address: place.formattedAddress ?? "주소 정보 없음",
        latitude: place.location.lat(),
        longitude: place.location.lng(),
      });

      // 장소를 선택하면 검색 세션이 종료되므로 토큰 초기화
      searchSessionRef.current = null;
    } catch (error) {
      console.error("장소 상세 정보 오류:", error);
      setErrorMessage("장소 정보를 불러오지 못했습니다.");
      searchSessionRef.current = null;
    } finally {
      setSearchLoading(false);
    }
  }

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
          <label
            htmlFor="place-search-input"
            className="text-sm font-semibold text-[#17181B]"
          >
            Place
          </label>

          <div className="mt-2 flex gap-2">
            <input
              id="place-search-input"
              type="text"
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value);
                searchRequestRef.current += 1;
                setSuggestions([]);
                setSelectedPlace(null);
                setSuggestionLoading(false);
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void handleSearch();
                }
              }}
              placeholder="장소 이름을 입력해주세요"
              className="min-w-0 flex-1 rounded-xl border border-[#E2E4E8] px-3 py-3 text-sm text-[#17181B] outline-none focus:border-[#6264F6]"
            />

            <button
              type="button"
              onClick={handleSearch}
              disabled={suggestionLoading || searchText.trim().length < 2}
              className="shrink-0 rounded-xl bg-[#6264F6] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              {suggestionLoading ? "검색 중" : "검색"}
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-[#E2E4E8] bg-white">
              {suggestions.map((prediction, index) => (
                <button
                  key={`${prediction.placeId}-${index}`}
                  type="button"
                  onClick={() => void handleSelectPlace(prediction)}
                  disabled={searchLoading}
                  className="block w-full border-b border-gray-100 px-4 py-3 text-left text-sm text-[#17181B] last:border-b-0 hover:bg-[#F7F7F5] disabled:opacity-50"
                >
                  {prediction.text.toString()}
                </button>
              ))}
            </div>
          )}

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
