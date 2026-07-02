import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Star } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Table, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { adminFetch } from "../../lib/client"

type Review = {
  id: string; product_id: string; display_name: string; email: string
  rating: number; title: string; body: string
  status: "pending" | "approved" | "rejected"; created_at: string
}

const STATUS_COLOR: Record<Review["status"], "orange" | "green" | "red"> = {
  pending: "orange", approved: "green", rejected: "red",
}

const ReviewsPage = () => {
  const [reviews, setReviews] = useState<Review[]>([])
  const [filter, setFilter] = useState<string>("pending")

  const load = (f = filter) =>
    adminFetch<{ reviews: Review[] }>(`/admin/reviews${f ? `?status=${f}` : ""}`)
      .then((d) => setReviews(d.reviews))
  useEffect(() => { load().catch((e) => toast.error(e.message)) }, [filter])

  const setStatus = async (r: Review, status: Review["status"]) => {
    await adminFetch(`/admin/reviews/${r.id}`, { json: { status } })
    toast.success(`Review ${status}`)
    await load()
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Reviews</Heading>
        <div className="flex gap-x-2">
          {["pending", "approved", "rejected", ""].map((f) => (
            <Button key={f || "all"} size="small"
              variant={filter === f ? "primary" : "secondary"}
              onClick={() => setFilter(f)}>
              {f || "all"}
            </Button>
          ))}
        </div>
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Rating</Table.HeaderCell>
            <Table.HeaderCell>Review</Table.HeaderCell>
            <Table.HeaderCell>By</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {reviews.map((r) => (
            <Table.Row key={r.id}>
              <Table.Cell>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</Table.Cell>
              <Table.Cell>
                <Text size="small" weight="plus">{r.title || "—"}</Text>
                <Text size="small" className="text-ui-fg-subtle line-clamp-2">{r.body}</Text>
              </Table.Cell>
              <Table.Cell>{r.display_name}</Table.Cell>
              <Table.Cell>
                <Badge size="2xsmall" color={STATUS_COLOR[r.status]}>{r.status}</Badge>
              </Table.Cell>
              <Table.Cell className="text-right whitespace-nowrap">
                {r.status !== "approved" && (
                  <Button size="small" variant="transparent" onClick={() => setStatus(r, "approved")}>Approve</Button>
                )}
                {r.status !== "rejected" && (
                  <Button size="small" variant="transparent" className="text-ui-fg-error" onClick={() => setStatus(r, "rejected")}>Reject</Button>
                )}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {reviews.length === 0 && (
        <div className="text-center text-ui-fg-subtle py-8">
          <Text size="small">No {filter || ""} reviews.</Text>
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Reviews",
  icon: Star,
})

export default ReviewsPage
