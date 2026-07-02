import { defineRouteConfig } from "@medusajs/admin-sdk"
import { DocumentText } from "@medusajs/icons"
import {
  Badge, Button, Container, Drawer, Heading, Input, Label, Switch, Table, Textarea, toast,
} from "@medusajs/ui"
import { useEffect, useState } from "react"
import { adminFetch, handleFor } from "../../lib/client"

type Post = {
  id: string; title: string; handle: string; category: string; read_time: string
  author: string; published_date: string; excerpt: string; body: string
  tint: string; image_url: string | null; status: "draft" | "published"
}

const EMPTY: Partial<Post> = {
  title: "", handle: "", category: "", read_time: "", author: "Atelier OMG",
  published_date: "", excerpt: "", body: "", tint: "20,42,84", status: "draft",
}

const JournalPage = () => {
  const [posts, setPosts] = useState<Post[]>([])
  const [editing, setEditing] = useState<Partial<Post> | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () =>
    adminFetch<{ posts: Post[] }>("/admin/journal").then((d) => setPosts(d.posts))
  useEffect(() => { load().catch((e) => toast.error(e.message)) }, [])

  const save = async () => {
    if (!editing?.title) return toast.error("Title is required")
    setBusy(true)
    try {
      const body = { ...editing, handle: editing.handle || handleFor(editing.title!) }
      if (editing.id) {
        const { id, ...patch } = body
        await adminFetch(`/admin/journal/${editing.id}`, { json: patch })
      } else {
        await adminFetch("/admin/journal", { json: body })
      }
      toast.success("Post saved")
      setEditing(null)
      await load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (p: Post) => {
    if (!confirm(`Delete "${p.title}"?`)) return
    await adminFetch(`/admin/journal/${p.id}`, { method: "DELETE" })
    toast.success("Post deleted")
    await load()
  }

  const field = (key: keyof Post, label: string, textarea = false, rows = 3) => (
    <div className="flex flex-col gap-y-1">
      <Label size="small">{label}</Label>
      {textarea ? (
        <Textarea rows={rows} value={(editing?.[key] as string) || ""}
          onChange={(e) => setEditing({ ...editing, [key]: e.target.value })} />
      ) : (
        <Input value={(editing?.[key] as string) || ""}
          onChange={(e) => setEditing({ ...editing, [key]: e.target.value })} />
      )}
    </div>
  )

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Journal</Heading>
        <Button size="small" onClick={() => setEditing({ ...EMPTY })}>Write post</Button>
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Title</Table.HeaderCell>
            <Table.HeaderCell>Category</Table.HeaderCell>
            <Table.HeaderCell>Author</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {posts.map((p) => (
            <Table.Row key={p.id}>
              <Table.Cell>{p.title}</Table.Cell>
              <Table.Cell>{p.category}</Table.Cell>
              <Table.Cell>{p.author}</Table.Cell>
              <Table.Cell>
                <Badge size="2xsmall" color={p.status === "published" ? "green" : "orange"}>{p.status}</Badge>
              </Table.Cell>
              <Table.Cell className="text-right">
                <Button size="small" variant="transparent" onClick={() => setEditing(p)}>Edit</Button>
                <Button size="small" variant="transparent" className="text-ui-fg-error" onClick={() => remove(p)}>Delete</Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      <Drawer open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{editing?.id ? "Edit post" : "New post"}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
            {field("title", "Title")}
            {field("category", "Category (Materials / Spotlight / Style / Technique)")}
            {field("read_time", "Read time (e.g. 6 min read)")}
            {field("author", "Author")}
            {field("published_date", "Display date (e.g. Jun 24, 2026)")}
            {field("excerpt", "Excerpt", true, 2)}
            {field("body", "Body (blank line = new paragraph)", true, 10)}
            {field("tint", "Tint (r,g,b)")}
            {field("image_url", "Cover image URL")}
            <div className="flex items-center gap-x-3">
              <Switch checked={editing?.status === "published"}
                onCheckedChange={(v) => setEditing({ ...editing, status: v ? "published" : "draft" })} />
              <Label size="small">Published</Label>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} isLoading={busy}>Save</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Journal",
  icon: DocumentText,
})

export default JournalPage
