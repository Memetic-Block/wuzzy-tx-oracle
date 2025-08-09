job "wuzzy-tx-oracle" {
  datacenters = ["mb-hel"]
  type = "service"

  reschedule {
    attempts = 0
  }

  group "wuzzy-tx-oracle-group" {
    count = 1

    update {
      stagger      = "30s"
      max_parallel = 1
      canary       = 1
      auto_revert  = true
      auto_promote = true
    }

    network {
      mode = "bridge"
      port "http" {
        host_network = "wireguard"
      }
    }

    task "wuzzy-tx-oracle-task" {
      driver = "docker"

      config {
        image = "ghcr.io/memetic-block/wuzzy-tx-oracle:${VERSION}"
      }

      env {
        VERSION="[[ .commit_sha ]]"
        DB_DATABASE="wuzzy-tx-oracle"
      }

      template {
        data = <<-EOF
        {{- range service "wuzzy-tx-oracle-redis" }}
        REDIS_HOST="{{ .Address }}"
        REDIS_PORT="{{ .Port }}"
        {{- end }}
        {{- range service "wuzzy-tx-oracle-postgres" }}
        DB_HOST="{{ .Address }}"
        DB_PORT="{{ .Port }}"
        {{- end }}
        EOF
        env = true
        destination = "local/config.env"
      }

      vault { policies = [ "wuzzy-tx-oracle" ] }

      template {
        data = <<-EOF
        {{ with secret "kv/wuzzy/tx-oracle" }}
        DB_USERNAME="{{ .Data.data.DB_USER }}"
        DB_PASSWORD="{{ .Data.data.DB_PASSWORD }}"
        {{ end }}
        EOF
        destination = "secrets/config.env"
        env = true
      }

      restart {
        attempts = 0
        mode     = "fail"
      }

      resources {
        cpu    = 1024
        memory = 2048
      }

      service {
        name = "wuzzy-tx-oracle"
        port = "http"

        check {
          type     = "http"
          path     = "/"
          interval = "10s"
          timeout  = "5s"
        }
      }
    }
  }
}
