-- MealMajor — Supabase Schema
-- Run this in the Supabase SQL Editor (https://app.supabase.com → SQL Editor)

-- Users table
create table if not exists users (
  id bigint generated always as identity primary key,
  email text unique not null,
  password text not null,
  diet text default '',
  allergies text default ''
);

-- Recipes table
create table if not exists recipes (
  id bigint generated always as identity primary key,
  title text not null,
  ingredients text[] default '{}',
  "prepTime" integer default 0,
  steps text[] default '{}',
  cost numeric(8,2) default 0,
  difficulty text default 'Easy',
  tags text[] default '{}',
  servings integer default 4,
  calories integer default 0,
  protein numeric(8,2) default 0,
  carbs numeric(8,2) default 0,
  fat numeric(8,2) default 0,
  category text default 'Main Course'
);

-- Meal Plans table (Sprint 3 — Weekly Meal Planner)
create table if not exists meal_plans (
  id bigint generated always as identity primary key,
  user_email text not null,
  week_start date not null,
  day text not null,
  meal_type text not null,
  recipe_id uuid references recipes(id) on delete set null,
  recipe_title text not null
);

-- Pantry Items table (Inventory Management)
create table if not exists pantry_items (
  id bigint generated always as identity primary key,
  user_email text not null,
  ingredient_name text not null,
  quantity numeric(8,2) default 1,
  unit text default '',
  added_date timestamp default now(),
  expiration_date date,
  category text default 'Other',
  unique(user_email, ingredient_name)
);

-- Meal Plan Templates table
create table if not exists meal_plan_templates (
  id bigint generated always as identity primary key,
  template_name text not null,
  description text,
  created_by text not null,
  is_public boolean default false,
  category text default 'Custom',
  created_date timestamp default now()
);

-- Template Entries table (stores the actual meal assignments)
create table if not exists template_entries (
  id bigint generated always as identity primary key,
  template_id bigint references meal_plan_templates(id) on delete cascade,
  day text not null,
  meal_type text not null,
  recipe_id uuid references recipes(id) on delete cascade,
  recipe_title text not null
);

-- Budget Tracking table
create table if not exists budget_tracking (
  id bigint generated always as identity primary key,
  user_email text not null,
  week_start date not null,
  planned_budget numeric(8,2) default 0,
  actual_spent numeric(8,2) default 0,
  notes text,
  unique(user_email, week_start)
);

-- User Goals table (nutrition and budget goals)
create table if not exists user_goals (
  id bigint generated always as identity primary key,
  user_email text unique not null,
  daily_calories integer default 2000,
  daily_protein numeric(8,2) default 50,
  daily_carbs numeric(8,2) default 250,
  daily_fat numeric(8,2) default 70,
  weekly_budget numeric(8,2) default 100
);
