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
        volumes = [
          "secrets/oracle_key.json:/usr/src/app/wallet.json",
        ]
      }

      env {
        VERSION="[[ .commit_sha ]]"
        PORT="${NOMAD_PORT_http}"
        IS_LIVE="true"
        DO_CLEAN="false"
        DO_DB_NUKE="false"
        ORACLE_JWK_PATH="/usr/src/app/wallet.json"
        DB_DATABASE="wuzzy-tx-oracle"
        MESSAGING_UNIT_ADDRESS="fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY"
        SCHEDULER_UNIT_ADDRESS="_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA"
        GQL_ENDPOINT="https://arweave-search.goldsky.com/graphql"
        GATEWAY_URL="https://arweave.net"
        PROCESS_ALLOWLIST=""
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

      template {
        data = "{{ with secret `kv/wuzzy/tx-oracle` }}{{ base64Decode .Data.data.ORACLE_KEY_BASE64 }}{{end}}"
        destination = "secrets/oracle_key.json"
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
