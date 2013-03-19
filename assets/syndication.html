<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">

  <title>{{settings.SITE_TITLE}}</title>
  <link rel="alternate" type="text/html" href="{{settings.SITE_URL}}"/>
  <link rel="self" type="application/atom+xml" href="{{settings.SITE_URL}}feed"/>
  <updated>{{updated|date('c')}}</updated>
  <id>urn:uuid:{{settings.SITE_ID}}</id>

  {% for row in rows %}
  <entry>
    <title>{{row.title}}</title>
    <id>urn:uuid:{{row.uuid}}</id>
    {% if row.updated_at %}
    <updated>{{row.updated_at|date('c')}}</updated>
    {% else %}
    <updated>{{row.created_at|date('c')}}</updated>
    {% endif %}
    <link href="{{settings.SITE_URL}}rows/{{row.slug}}"/>
    <summary>{{row.summary}}</summary>
    <author>
      <name>{{row.first_name|default("")}} {{row.last_name|default("")}}</name>
      <email>{{row.email|default("")}}</email>
    </author>
    <content type="xhtml" xml:lang="en" xml:base="{{settings.SITE_URL}}">
      <div xmlns="http://www.w3.org/1999/xhtml">
        {% autoescape off %}
        {{row.body|markdown}}
        {% endautoescape %}
      </div>
    </content>
  </entry>
  {% endfor %}

</feed>