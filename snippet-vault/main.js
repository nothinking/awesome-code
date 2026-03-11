(function () {
  "use strict";

  const STORAGE_KEY = "snippet-vault:v1";

  const starterSnippets = [
    {
      id: "seed-1",
      title: "Fetch JSON Safely",
      language: "js",
      tags: ["fetch", "api", "async"],
      content:
        "async function fetchJson(url) {\n  const response = await fetch(url);\n  if (!response.ok) {\n    throw new Error(`Request failed: ${response.status}`);\n  }\n  return response.json();\n}",
      notes: "기본적인 에러 처리를 같이 넣은 fetch 헬퍼.",
      favorite: true,
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
    },
    {
      id: "seed-2",
      title: "Git Branch Cleanup",
      language: "bash",
      tags: ["git", "cli"],
      content: "git fetch --prune\n\ngit branch --merged | egrep -v '(^\\*|main|master)' | xargs git branch -d",
      notes: "병합된 로컬 브랜치를 정리할 때.",
      favorite: false,
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
    },
    {
      id: "seed-3",
      title: "Responsive Clamp",
      language: "css",
      tags: ["css", "responsive", "typography"],
      content: "font-size: clamp(1rem, 2vw + 0.5rem, 2.4rem);",
      notes: "최소값과 최대값을 함께 주는 반응형 타이포 패턴.",
      favorite: true,
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
    },
  ];

  const snippetForm = document.getElementById("snippet-form");
  const titleInput = document.getElementById("title-input");
  const languageInput = document.getElementById("language-input");
  const tagsInput = document.getElementById("tags-input");
  const contentInput = document.getElementById("content-input");
  const notesInput = document.getElementById("notes-input");
  const resetButton = document.getElementById("reset-button");
  const searchInput = document.getElementById("search-input");
  const favoritesOnlyInput = document.getElementById("favorites-only");
  const tagRow = document.getElementById("tag-row");
  const snippetList = document.getElementById("snippet-list");
  const statusMessage = document.getElementById("status-message");
  const snippetCardTemplate = document.getElementById("snippet-card-template");
  const totalCount = document.getElementById("total-count");
  const favoriteCount = document.getElementById("favorite-count");
  const visibleCount = document.getElementById("visible-count");

  const state = {
    snippets: loadSnippets(),
    search: "",
    activeTag: "",
    favoritesOnly: false,
    editingId: "",
  };

  function loadSnippets() {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(starterSnippets));
      return starterSnippets.slice();
    }

    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : starterSnippets.slice();
    } catch (error) {
      return starterSnippets.slice();
    }
  }

  function saveSnippets() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.snippets));
  }

  function createId() {
    return "snippet-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8);
  }

  function normalizeTags(value) {
    return value
      .split(",")
      .map(function (tag) {
        return tag.trim();
      })
      .filter(Boolean);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  function setStatus(message) {
    statusMessage.textContent = message;
  }

  function resetForm(message) {
    state.editingId = "";
    snippetForm.reset();
    titleInput.focus();
    setStatus(message || "새 스니펫 작성 중.");
  }

  function fillForm(snippet) {
    state.editingId = snippet.id;
    titleInput.value = snippet.title;
    languageInput.value = snippet.language;
    tagsInput.value = snippet.tags.join(", ");
    contentInput.value = snippet.content;
    notesInput.value = snippet.notes;
    titleInput.focus();
    setStatus("편집 모드로 전환됨: " + snippet.title);
  }

  function getAllTags() {
    const tags = new Set();
    for (const snippet of state.snippets) {
      for (const tag of snippet.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort();
  }

  function getFilteredSnippets() {
    const query = state.search.trim().toLowerCase();

    return state.snippets
      .filter(function (snippet) {
        if (state.favoritesOnly && !snippet.favorite) {
          return false;
        }

        if (state.activeTag && !snippet.tags.includes(state.activeTag)) {
          return false;
        }

        if (!query) {
          return true;
        }

        const haystack = [
          snippet.title,
          snippet.language,
          snippet.tags.join(" "),
          snippet.content,
          snippet.notes,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort(function (a, b) {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }

  function renderStats(filteredSnippets) {
    totalCount.textContent = String(state.snippets.length);
    favoriteCount.textContent = String(
      state.snippets.filter(function (snippet) {
        return snippet.favorite;
      }).length
    );
    visibleCount.textContent = String(filteredSnippets.length);
  }

  function renderTagFilters() {
    const tags = getAllTags();
    tagRow.textContent = "";

    const allButton = document.createElement("button");
    allButton.className = "tag-filter" + (state.activeTag === "" ? " active" : "");
    allButton.type = "button";
    allButton.textContent = "All";
    allButton.addEventListener("click", function () {
      state.activeTag = "";
      render();
    });
    tagRow.appendChild(allButton);

    for (const tag of tags) {
      const button = document.createElement("button");
      button.className = "tag-filter" + (state.activeTag === tag ? " active" : "");
      button.type = "button";
      button.textContent = "#" + tag;
      button.addEventListener("click", function () {
        state.activeTag = state.activeTag === tag ? "" : tag;
        render();
      });
      tagRow.appendChild(button);
    }
  }

  function renderSnippetList() {
    const filteredSnippets = getFilteredSnippets();
    snippetList.textContent = "";
    renderStats(filteredSnippets);

    if (filteredSnippets.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "empty-state";
      emptyState.textContent = "일치하는 스니펫이 없다. 검색어를 바꾸거나 새 스니펫을 추가하면 된다.";
      snippetList.appendChild(emptyState);
      return;
    }

    for (const snippet of filteredSnippets) {
      const fragment = snippetCardTemplate.content.cloneNode(true);
      const card = fragment.querySelector(".snippet-card");
      const language = fragment.querySelector(".snippet-language");
      const title = fragment.querySelector(".snippet-title");
      const favoriteButton = fragment.querySelector(".favorite-button");
      const tags = fragment.querySelector(".snippet-tags");
      const updated = fragment.querySelector(".snippet-updated");
      const content = fragment.querySelector(".snippet-content");
      const notes = fragment.querySelector(".snippet-notes");
      const copyButton = fragment.querySelector(".copy-button");
      const editButton = fragment.querySelector(".edit-button");
      const deleteButton = fragment.querySelector(".delete-button");

      language.textContent = snippet.language || "text";
      title.textContent = snippet.title;
      favoriteButton.textContent = snippet.favorite ? "★" : "☆";
      favoriteButton.classList.toggle("active", snippet.favorite);
      updated.textContent = formatDate(snippet.updatedAt);
      content.textContent = snippet.content;
      notes.textContent = snippet.notes || "";
      card.classList.toggle("favorite", snippet.favorite);

      for (const tag of snippet.tags) {
        const tagElement = document.createElement("span");
        tagElement.className = "snippet-tag";
        tagElement.textContent = "#" + tag;
        tags.appendChild(tagElement);
      }

      favoriteButton.addEventListener("click", function () {
        snippet.favorite = !snippet.favorite;
        snippet.updatedAt = new Date().toISOString();
        saveSnippets();
        setStatus((snippet.favorite ? "즐겨찾기 추가됨: " : "즐겨찾기 해제됨: ") + snippet.title);
        render();
      });

      copyButton.addEventListener("click", function () {
        navigator.clipboard
          .writeText(snippet.content)
          .then(function () {
            setStatus("복사 완료: " + snippet.title);
          })
          .catch(function () {
            setStatus("클립보드 복사 실패. 브라우저 권한을 확인해야 한다.");
          });
      });

      editButton.addEventListener("click", function () {
        fillForm(snippet);
      });

      deleteButton.addEventListener("click", function () {
        const confirmed = window.confirm("이 스니펫을 삭제할까?");
        if (!confirmed) {
          return;
        }

        state.snippets = state.snippets.filter(function (item) {
          return item.id !== snippet.id;
        });
        if (state.editingId === snippet.id) {
          resetForm("새 스니펫 작성 중.");
        }
        saveSnippets();
        setStatus("삭제됨: " + snippet.title);
        render();
      });

      snippetList.appendChild(fragment);
    }
  }

  function render() {
    renderTagFilters();
    renderSnippetList();
  }

  snippetForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const now = new Date().toISOString();
    const nextSnippet = {
      id: state.editingId || createId(),
      title: titleInput.value.trim(),
      language: languageInput.value.trim(),
      tags: normalizeTags(tagsInput.value),
      content: contentInput.value.trim(),
      notes: notesInput.value.trim(),
      favorite: false,
      createdAt: now,
      updatedAt: now,
    };

    if (!nextSnippet.title || !nextSnippet.content) {
      setStatus("제목과 스니펫 본문은 필요하다.");
      return;
    }

    if (state.editingId) {
      const current = state.snippets.find(function (snippet) {
        return snippet.id === state.editingId;
      });
      if (current) {
        nextSnippet.favorite = current.favorite;
        nextSnippet.createdAt = current.createdAt;
      }

      state.snippets = state.snippets.map(function (snippet) {
        return snippet.id === state.editingId ? nextSnippet : snippet;
      });
      resetForm("업데이트됨: " + nextSnippet.title);
    } else {
      state.snippets.unshift(nextSnippet);
      resetForm("추가됨: " + nextSnippet.title);
    }

    saveSnippets();
    render();
  });

  resetButton.addEventListener("click", function () {
    resetForm();
    render();
  });

  searchInput.addEventListener("input", function () {
    state.search = searchInput.value;
    render();
  });

  favoritesOnlyInput.addEventListener("change", function () {
    state.favoritesOnly = favoritesOnlyInput.checked;
    render();
  });

  render();
  setStatus("Vault loaded.");
})();
