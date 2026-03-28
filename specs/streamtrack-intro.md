# StreamTrack Introduction

## What StreamTrack Is

StreamTrack is a streaming discovery and watchlist platform built to help people decide what to watch faster. Instead of opening multiple apps and scrolling through disconnected catalogs, users can search by title, browse trends, and discover content based on mood or vibe.

The product combines discovery, personalization, and lightweight tracking into one experience. A user can save titles, mark progress, and return later without losing context about where they left off or why a title looked interesting in the first place.

## Why It Exists

Modern streaming is fragmented. Great movies and shows are spread across providers, recommendation quality is inconsistent, and it is easy to forget what to watch next. StreamTrack is designed to reduce that friction by giving users one place to explore options that fit their taste and current mood.

## Core Experience

The core experience combines title search across movies and TV shows, discovery through predefined or custom vibes, trending browsing with provider-aware filtering, and a personal watchlist that supports simple status tracking from want to watched.

---

## How It Works Today

StreamTrack runs as a Bun-based monorepo with an Angular frontend and an Express backend. The frontend handles search, discovery, onboarding, and watchlist views, while the backend manages auth validation, user preferences, watchlist persistence, and integrations with external content services.

In practical terms, the current system uses Angular standalone components for the user-facing product experience, Express on Bun for API routing, MongoDB with Mongoose for persistent user data, Firebase Auth for identity, and TMDB for entertainment metadata and discovery inputs.

## Who It Is For

The product is aimed at viewers who already subscribe to multiple streaming services and want less browsing fatigue. It is especially useful for people who like mood-based recommendations, keep informal watchlists, or struggle to remember where specific titles are available.

## Near-Term Direction

The near-term direction is focused on improving consistency between API behavior and documentation, strengthening provider and region handling, refining discovery quality so recommendations feel more intentional, and continuing to polish onboarding, watchlist flows, and critical tests.

## Closing Note

At its best, StreamTrack acts like a lightweight decision layer on top of the streaming services people already use. The goal is not to replace those platforms, but to make choosing the next movie or show feel quicker, clearer, and more personal.
