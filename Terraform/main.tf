resource "google_project_service" "pubsub" {
  project = var.gcp_project
  service = "pubsub.googleapis.com"
}

resource "google_pubsub_topic" "jobs" {
  name = var.pubsub_jobs_topic

  depends_on = [google_project_service.pubsub]
}

resource "google_pubsub_topic" "events" {
  name = var.pubsub_events_topic

  depends_on = [google_project_service.pubsub]
}

resource "google_pubsub_subscription" "jobs" {
  name  = var.pubsub_jobs_subscription
  topic = google_pubsub_topic.jobs.name
}

resource "google_pubsub_subscription" "events" {
  name  = var.pubsub_events_subscription
  topic = google_pubsub_topic.events.name
}
